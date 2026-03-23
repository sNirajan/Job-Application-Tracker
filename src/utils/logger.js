const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: config.isTest ? 'silent' : config.isProduction ? 'info' : 'debug',
  transport: !config.isProduction && !config.isTest
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

module.exports = logger;