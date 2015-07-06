var knex = require('knex');
var config = require('./knexfile');

module.exports = knex(config[process.env.NODE_ENV] || config);
