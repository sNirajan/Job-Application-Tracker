const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv },
    `Server running on port ${config.port}`
  );
});

// The AWS load balancer (and any proxy in front of us) keeps idle
// connections open for 60 seconds and reuses them. Node's default is to
// close them after 5 seconds, so the proxy sometimes sends a request on a
// connection we just closed and the user gets a random 502. Keeping
// connections open longer than the proxy does avoids that.
server.keepAliveTimeout = 65 * 1000;
server.headersTimeout = 66 * 1000; // must be greater than keepAliveTimeout
