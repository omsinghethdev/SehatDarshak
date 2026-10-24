import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import { createAutoRefresh, fetchLoadedPages } from '../src/lib/autoRefresh.js';
import { ASSISTANCE_REFRESH_INTERVAL_MS, DASHBOARD_REFRESH_INTERVAL_MS } from '../src/lib/refreshIntervals.js';

// Lets queued promise callbacks run (fake timers do not advance microtasks by themselves).
const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

function fakeVisibility() {
  let hidden = false;
  const listeners = new Set();
  return {
    isHidden: () => hidden,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setHidden(value) {
      hidden = value;
      listeners.forEach((listener) => listener());
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

// A request that resolves (or rejects) only when the test says so.
function controllableRun() {
  const calls = [];
  const run = (signal) =>
    new Promise((resolve, reject) => {
      calls.push({ signal, resolve, reject });
    });
  return { run, calls };
}

function track(options) {
  const events = [];
  const poller = createAutoRefresh({
    onStart: () => events.push('start'),
    onSuccess: () => events.push('success'),
    onError: (error) => events.push(`error:${error.code ?? error.message}`),
    onSettled: () => events.push('settled'),
    ...options,
  });
  return { poller, events };
}

describe('background auto-refresh', () => {
  let visibility;
  const started = [];
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout'] });
    visibility = fakeVisibility();
  });
  afterEach(() => {
    started.splice(0).forEach((poller) => poller.stop());
    mock.timers.reset();
  });
  const create = (options) => {
    const result = track({ visibility, ...options });
    started.push(result.poller);
    return result;
  };

  test('patient pages refresh every 30 seconds', () => {
    assert.equal(DASHBOARD_REFRESH_INTERVAL_MS, 30_000);
    assert.equal(ASSISTANCE_REFRESH_INTERVAL_MS, 30_000);
  });

  test('refreshes on the configured interval, and not at start (no extra Strict Mode request)', async () => {
    const run = mock.fn(async () => {});
    create({ run, intervalMs: DASHBOARD_REFRESH_INTERVAL_MS });

    await flush();
    assert.equal(run.mock.callCount(), 0);
    mock.timers.tick(DASHBOARD_REFRESH_INTERVAL_MS - 1);
    await flush();
    assert.equal(run.mock.callCount(), 0);

    mock.timers.tick(1);
    await flush();
    assert.equal(run.mock.callCount(), 1);
    mock.timers.tick(DASHBOARD_REFRESH_INTERVAL_MS);
    await flush();
    assert.equal(run.mock.callCount(), 2);
  });

  test('the assistance history refreshes on its own interval', async () => {
    const run = mock.fn(async () => {});
    create({ run, intervalMs: ASSISTANCE_REFRESH_INTERVAL_MS });

    for (let round = 1; round <= 3; round += 1) {
      mock.timers.tick(ASSISTANCE_REFRESH_INTERVAL_MS);
      await flush();
      assert.equal(run.mock.callCount(), round);
    }
  });

  test('a mount, unmount, and remount (React Strict Mode) leaves one schedule and sends nothing early', async () => {
    const run = mock.fn(async () => {});
    const first = createAutoRefresh({ run, intervalMs: 1000, visibility });
    first.stop();
    create({ run, intervalMs: 1000 });

    await flush();
    assert.equal(run.mock.callCount(), 0);
    assert.equal(visibility.listenerCount, 1);
    mock.timers.tick(1000);
    await flush();
    assert.equal(run.mock.callCount(), 1);
  });

  test('pauses while the tab is hidden and refreshes as soon as it is visible again', async () => {
    const run = mock.fn(async () => {});
    create({ run, intervalMs: 1000 });

    visibility.setHidden(true);
    mock.timers.tick(10_000);
    await flush();
    assert.equal(run.mock.callCount(), 0, 'no requests while hidden');

    visibility.setHidden(false);
    await flush();
    assert.equal(run.mock.callCount(), 1, 'immediate refresh on return');

    // The regular schedule resumes from that refresh.
    mock.timers.tick(999);
    await flush();
    assert.equal(run.mock.callCount(), 1);
    mock.timers.tick(1);
    await flush();
    assert.equal(run.mock.callCount(), 2);
  });

  test('manual refresh runs at once and restarts the countdown', async () => {
    const run = mock.fn(async () => {});
    const { poller, events } = create({ run, intervalMs: 1000 });

    mock.timers.tick(600);
    await poller.refresh();
    await flush();
    assert.equal(run.mock.callCount(), 1);
    assert.deepEqual(events, ['start', 'success', 'settled']);

    // No scheduled request 400 ms later (would be back to back); the next one is 1000 ms on.
    mock.timers.tick(999);
    await flush();
    assert.equal(run.mock.callCount(), 1);
    mock.timers.tick(1);
    await flush();
    assert.equal(run.mock.callCount(), 2);
  });

  test('a manual refresh during a scheduled one joins it instead of sending a second request', async () => {
    const { run, calls } = controllableRun();
    const { poller, events } = create({ run, intervalMs: 1000 });

    mock.timers.tick(1000);
    await flush();
    assert.equal(calls.length, 1);

    const manual = poller.refresh();
    const again = poller.refresh();
    visibility.setHidden(false); // a visibility event while busy is also absorbed
    await flush();
    assert.equal(calls.length, 1, 'still one request in flight');
    assert.equal(manual, again);

    calls[0].resolve();
    await manual;
    assert.deepEqual(events, ['start', 'success', 'settled']);
  });

  test('a slow request never overlaps the next scheduled one', async () => {
    const { run, calls } = controllableRun();
    create({ run, intervalMs: 1000 });

    mock.timers.tick(1000);
    await flush();
    mock.timers.tick(5000); // request still pending: no timer is running meanwhile
    await flush();
    assert.equal(calls.length, 1);

    calls[0].resolve();
    await flush();
    mock.timers.tick(1000);
    await flush();
    assert.equal(calls.length, 2);
  });

  test('a failed refresh is reported, keeps the schedule, and is cleared by the next success', async () => {
    let fail = true;
    const data = { tokens: ['OPD-001'] };
    const run = mock.fn(async () => {
      if (fail) throw Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' });
      data.tokens = ['OPD-001', 'OPD-002'];
    });
    const { events } = create({ run, intervalMs: 1000 });

    mock.timers.tick(1000);
    await flush();
    assert.deepEqual(events, ['start', 'error:NETWORK_ERROR', 'settled']);
    assert.deepEqual(data.tokens, ['OPD-001'], 'last good data is untouched');

    fail = false;
    mock.timers.tick(1000);
    await flush();
    assert.deepEqual(events.slice(3), ['start', 'success', 'settled']);
    assert.deepEqual(data.tokens, ['OPD-001', 'OPD-002']);
  });

  test('an expired session is passed through once; the existing sign-out then stops polling', async () => {
    // The API client itself signs the user out on a 401 (AuthProvider's unauthorized handler);
    // the poller adds no handling of its own and must not retry before the page unmounts.
    const run = mock.fn(async () => {
      throw Object.assign(new Error('Session expired'), { code: 'UNAUTHORIZED', status: 401 });
    });
    const { poller, events } = create({ run, intervalMs: 1000 });

    mock.timers.tick(1000);
    await flush();
    assert.equal(run.mock.callCount(), 1);
    assert.deepEqual(events, ['start', 'error:UNAUTHORIZED', 'settled']);

    poller.stop(); // the sign-out redirects to /login, unmounting the page
    mock.timers.tick(10_000);
    visibility.setHidden(true);
    visibility.setHidden(false);
    await flush();
    assert.equal(run.mock.callCount(), 1, 'no requests after sign-out');
    assert.equal(events.length, 3);
  });

  test('stop() clears the timer and the visibility listener, aborts the request, and silences callbacks', async () => {
    const { run, calls } = controllableRun();
    const { poller, events } = create({ run, intervalMs: 1000 });
    assert.equal(visibility.listenerCount, 1);

    mock.timers.tick(1000);
    await flush();
    poller.stop();
    assert.equal(calls[0].signal.aborted, true);
    assert.equal(visibility.listenerCount, 0);

    calls[0].resolve();
    await flush();
    mock.timers.tick(10_000);
    visibility.setHidden(false);
    await poller.refresh();
    await flush();
    assert.equal(calls.length, 1);
    assert.deepEqual(events, ['start'], 'no success/settled after stop');
  });
});

describe('re-reading loaded pages', () => {
  const requests = Array.from({ length: 25 }, (_, index) => ({ id: `req_${index}`, status: index % 2 ? 'open' : 'acknowledged' }));
  const fetchPageFrom = (list) =>
    mock.fn(async ({ page, limit }) => ({
      items: list.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: list.length },
    }));

  test('two loaded pages are re-read in one request and keep meta usable for "load more"', async () => {
    const fetchPage = fetchPageFrom(requests);

    const result = await fetchLoadedPages(fetchPage, { loadedPages: 2, pageSize: 10 });

    assert.equal(fetchPage.mock.callCount(), 1);
    assert.deepEqual(fetchPage.mock.calls[0].arguments[0], { page: 1, limit: 20, signal: undefined });
    assert.deepEqual(result.items.map((item) => item.id), requests.slice(0, 20).map((item) => item.id));
    assert.deepEqual(result.meta, { page: 2, limit: 10, total: 25 });
  });

  test('an acknowledgement made by staff shows up in the refreshed items', async () => {
    const list = requests.map((item) => ({ ...item }));
    const fetchPage = fetchPageFrom(list);
    list[1].status = 'acknowledged';

    const { items } = await fetchLoadedPages(fetchPage, { loadedPages: 1, pageSize: 10 });

    assert.equal(items[1].status, 'acknowledged');
  });

  test('beyond the server page-size limit, each loaded page is fetched in turn without duplicates', async () => {
    const fetchPage = fetchPageFrom(requests);

    const result = await fetchLoadedPages(fetchPage, { loadedPages: 3, pageSize: 10, maxLimit: 20 });

    assert.deepEqual(fetchPage.mock.calls.map((call) => call.arguments[0].page), [1, 2, 3]);
    assert.equal(new Set(result.items.map((item) => item.id)).size, 25);
    assert.deepEqual(result.meta, { page: 3, limit: 10, total: 25 });
  });

  test('items that shift between page requests are not duplicated', async () => {
    const list = requests.slice(0, 20);
    const fetchPage = mock.fn(async ({ page, limit }) => {
      // A new request arrives between the two page reads, pushing item 9 onto page 2.
      if (page === 2) list.unshift({ id: 'req_new', status: 'open' });
      return { items: list.slice((page - 1) * limit, page * limit), meta: { page, limit, total: list.length } };
    });

    const { items } = await fetchLoadedPages(fetchPage, { loadedPages: 2, pageSize: 10, maxLimit: 10 });

    assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  });
});
