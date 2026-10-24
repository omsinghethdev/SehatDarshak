import { HttpError } from './httpError.js';

/**
 * Counts failures (for example wrong passwords) per key in a fixed time window and blocks the key
 * once `max` failures are reached, until the window ends. In-memory and per process: it slows
 * down guessing against one instance, but is not shared between instances or kept across restarts.
 */
export function createFailureLimiter({ max, windowMs, now = () => Date.now() }) {
  const entries = new Map();

  function current(key) {
    const entry = entries.get(key);
    if (entry && entry.resetAt <= now()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  }

  function prune() {
    if (entries.size < 10_000) return;
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now()) entries.delete(key);
    }
  }

  return {
    // Throws 429 TOO_MANY_REQUESTS while the key is blocked.
    assertAllowed(key) {
      const entry = current(key);
      if (entry && entry.count >= max) {
        const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now()) / 1000));
        throw tooManyRequestsError(retryAfterSeconds);
      }
    },
    recordFailure(key) {
      prune();
      const entry = current(key) ?? { count: 0, resetAt: now() + windowMs };
      entry.count += 1;
      entries.set(key, entry);
    },
    reset(key) {
      entries.delete(key);
    },
  };
}

export function tooManyRequestsError(retryAfterSeconds) {
  const error = new HttpError(429, 'TOO_MANY_REQUESTS', 'Too many failed attempts. Please wait and try again.');
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}
