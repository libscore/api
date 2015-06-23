var knex = require('knex');
var conn = knex(require('./knexfile.js'));

module.exports = require('bookshelf')(conn);
