const developmentOrigins = ['http://localhost:5173'];

function parseOrigins(value) {
  return (value || '')
    .split(',')
    .map((origin) => origin.trim())
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
