// Application entry point: load configuration, connect the database adapter
// and start listening. Listening on 0.0.0.0 is required inside Docker so
// that traffic from outside the container can reach the app.

const { loadConfig } = require('./config');
const { createLogger } = require('./logger');
const { createStore } = require('./db');
const { createApp } = require('./app');

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    createLogger('info').error('invalid configuration', { errorMessage: error.message });
    process.exit(1);
  }

  const logger = createLogger(config.logLevel, { service: 'smart-campus-api' });
  if (!process.env.JWT_SECRET) {
    logger.warn('JWT_SECRET is not set; using a random development secret');
  }

  const store = createStore(config.db);
  const app = createApp({ config, store, logger });

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info('server started', {
      port: config.port,
      environment: config.nodeEnv,
      version: config.appVersion,
      database: store.driver,
    });
  });

  // Elastic Beanstalk and Docker send SIGTERM when stopping the container.
  // Finish in-flight requests before exiting.
  const shutdown = (signal) => {
    logger.info('shutting down', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
