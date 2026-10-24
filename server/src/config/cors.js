const developmentOrigins = ['http://localhost:5173'];

// Browsers send Origin without a trailing slash, so "https://app.example/" is normalised
// to match. A "*" entry matches nothing: every allowed origin must be listed explicitly.
function parseOrigins(value) {
  return (value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function createCorsOptions({
  environment = process.env.NODE_ENV,
  originValue = process.env.CORS_ORIGIN,
} = {}) {
  const configuredOrigins = parseOrigins(originValue);
  const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : environment === 'production'
      ? []
      : developmentOrigins;

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    optionsSuccessStatus: 204,
  };
}
