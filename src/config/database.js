const knex = require('knex');
const knexConfig = require('../../knexfile');
const config = require('./index');

const environment = config.nodeEnv || 'development';
const db = knex(knexConfig[environment]);

module.exports = db;