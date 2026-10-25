export class ProxyConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProxyConfigurationError';
  }
}

/**
 * Express "trust proxy" setting from TRUST_PROXY: the number of reverse-proxy hops in front of
 * the API (for example 1 behind the Docker frontend's Nginx). It makes request.ip the client's
 * address rather than the proxy's, which the login rate limiter relies on. Unset or empty means
 * no proxy is trusted (the default, for running the API directly).
 */
export function getTrustProxy({ value = process.env.TRUST_PROXY } = {}) {
  const text = (value ?? '').trim();
  if (!text) return false;
  if (!/^\d{1,2}$/.test(text)) {
    throw new ProxyConfigurationError('TRUST_PROXY must be a whole number of proxy hops (for example 1), or left unset.');
  }
  const hops = Number(text);
  return hops === 0 ? false : hops;
}
