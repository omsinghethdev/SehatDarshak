import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import {
  DatabaseConfigurationError,
  DatabaseConnectionError,
  connectDatabase,
  disconnectDatabase,
} from './config/database.js';

const defaultPort = Number(process.env.PORT) || 5000;

function listen(appInstance, port) {
  return new Promise((resolve, reject) => {
    const httpServer = appInstance.listen(port);

    const onError = (error) => {
      httpServer.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      httpServer.removeListener('error', onError);
      console.log(`SehatDarshak API listening on port ${port}`);
      resolve(httpServer);
    };

    httpServer.once('error', onError);
    httpServer.once('listening', onListening);
  });
}

export async function startServer({
  appInstance = app,
  port = defaultPort,
  databaseConnector = connectDatabase,
} = {}) {
  await databaseConnector();

  try {
    return await listen(appInstance, port);
  } catch (error) {
    await disconnectDatabase();
    throw error;
  }
}

export async function stopServer(httpServer) {
  if (httpServer?.listening) {
    await new Promise((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await disconnectDatabase();
}

export function startupFailureMessage(error, port) {
  if (error instanceof DatabaseConfigurationError || error instanceof DatabaseConnectionError) {
    return error.message;
  }

  if (error?.code === 'EADDRINUSE') {
    return `Port ${port} is already in use. Stop the process using it (on macOS, AirPlay Receiver uses port 5000) or set a different PORT in server/.env.`;
  }

  if (error?.code === 'EACCES' || error?.code === 'EPERM') {
    return `Permission was denied while binding to port ${port}.`;
  }

  return 'Unable to start the HTTP server. Check port configuration.';
}

async function bootstrap() {
  let httpServer;

  try {
    httpServer = await startServer();
  } catch (error) {
    console.error(`Server startup failed: ${startupFailureMessage(error, defaultPort)}`);
    process.exitCode = 1;
    return;
  }

  const shutdown = async (signal) => {
    console.log(`${signal} received; shutting down.`);

    try {
      await stopServer(httpServer);
    } catch (_error) {
      console.error('Server shutdown encountered an error.');
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void bootstrap();
}
