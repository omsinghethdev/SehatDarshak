import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

// qrPayload reads window.location.origin when validating; give it a fixed app origin.
const ORIGIN = 'https://sehat.example.org';
globalThis.window = { location: { origin: ORIGIN } };
const { buildQrUrl, parseQrPayload, tokenQrPayload } = await import('../src/features/qr/qrPayload.js');

const SERVER_TOKEN_ID = 'token_3f9a2c1b0d4e5f6a7b8c9d0e';
const MOCK_TOKEN_ID = 'token_mock_0b6c4c9e-3d2a-4f7b-9a1e-5c2d8e7f6a10';

describe('token QR payload', () => {
  test('is built only from a valid token reference returned by the service', () => {
    assert.deepEqual(tokenQrPayload(SERVER_TOKEN_ID), { type: 'token', id: SERVER_TOKEN_ID });
    assert.deepEqual(tokenQrPayload(MOCK_TOKEN_ID), { type: 'token', id: MOCK_TOKEN_ID });
  });

  test('missing or malformed token references produce no QR', () => {
    for (const id of [undefined, null, '', 42, 'token 1', '../admin', 'token_1?x=1', 'a'.repeat(65), { id: 'x' }]) {
      assert.equal(tokenQrPayload(id), null, String(id));
    }
  });

  test('the QR URL is the /scan route with exactly type, id, and version', () => {
    const url = buildQrUrl(tokenQrPayload(SERVER_TOKEN_ID), ORIGIN);
    assert.equal(url, `${ORIGIN}/scan?type=token&id=${SERVER_TOKEN_ID}&v=1`);

    const parsed = new URL(url);
    assert.deepEqual([...parsed.searchParams.keys()], ['type', 'id', 'v']);
    assert.equal(parsed.hash, '');
    assert.equal(parsed.username + parsed.password, '');
  });

  test('carries no credentials or personal data', () => {
    const url = buildQrUrl(tokenQrPayload(SERVER_TOKEN_ID), ORIGIN);
    assert.doesNotMatch(url, /bearer|jwt|access|password|name=|phone|patient/i);
    assert.ok(url.length < 120, `unexpectedly long QR URL (${url.length})`);
  });

  test('round-trips through the scanner parser', () => {
    for (const id of [SERVER_TOKEN_ID, MOCK_TOKEN_ID]) {
      assert.deepEqual(parseQrPayload(buildQrUrl(tokenQrPayload(id), ORIGIN)), { ok: true, payload: { type: 'token', id } });
    }
  });
});

describe('scanner validation of token URLs', () => {
  const scan = (query, origin = ORIGIN) => parseQrPayload(`${origin}/scan?${query}`);

  test('rejects a token URL without an ID or with a malformed ID', () => {
    assert.deepEqual(scan('type=token&v=1'), { ok: false, reason: 'missingId' });
    assert.deepEqual(scan('type=token&id=bad%20id&v=1'), { ok: false, reason: 'invalidId' });
    assert.deepEqual(scan(`type=token&id=${'a'.repeat(65)}`), { ok: false, reason: 'invalidId' });
  });

  test('rejects extra parameters, so nothing else can ride along in a token QR', () => {
    for (const extra of ['name=Asha', 'access_token=abc', 'role=admin', `id=${SERVER_TOKEN_ID}`]) {
      assert.deepEqual(scan(`type=token&id=${SERVER_TOKEN_ID}&${extra}`), { ok: false, reason: 'unexpectedParam' }, extra);
    }
  });

  test('rejects token URLs for other sites, paths, or versions', () => {
    assert.deepEqual(scan(`type=token&id=${SERVER_TOKEN_ID}`, 'https://evil.example'), { ok: false, reason: 'externalUrl' });
    assert.deepEqual(parseQrPayload(`${ORIGIN}/queue/tokens/${SERVER_TOKEN_ID}`), { ok: false, reason: 'unsupportedRoute' });
    assert.deepEqual(scan(`type=token&id=${SERVER_TOKEN_ID}&v=2`), { ok: false, reason: 'unsupportedVersion' });
  });
});

describe('existing QR types are unchanged', () => {
  const scan = (query) => parseQrPayload(`${ORIGIN}/scan?${query}`);

  test('hospital, department, location, and queue codes still parse', () => {
    assert.deepEqual(scan('type=hospital&v=1'), { ok: true, payload: { type: 'hospital' } });
    assert.deepEqual(scan('type=department&id=dept_demo_opd&v=1'), { ok: true, payload: { type: 'department', id: 'dept_demo_opd' } });
    assert.deepEqual(scan('type=location&id=room_registration'), { ok: true, payload: { type: 'location', id: 'room_registration' } });
    assert.deepEqual(scan('type=queue&id=dept_demo_med&v=1'), { ok: true, payload: { type: 'queue', id: 'dept_demo_med' } });
  });

  test('their stricter ID rule still applies (no uppercase or hyphens)', () => {
    assert.deepEqual(scan('type=department&id=Dept_OPD'), { ok: false, reason: 'invalidId' });
    assert.deepEqual(scan('type=location&id=room-1'), { ok: false, reason: 'invalidId' });
  });

  test('unknown types and a hospital code with an ID are still rejected', () => {
    assert.deepEqual(scan('type=patient&id=x'), { ok: false, reason: 'unsupportedType' });
    assert.deepEqual(scan('type=hospital&id=x'), { ok: false, reason: 'unexpectedParam' });
  });
});
