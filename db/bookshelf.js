var knex = require('knex');
var config = require('./knexfile');

var conn = knex(config[process.env.NODE_ENV] || config)
var bookshelf = require('bookshelf')(conn);
bookshelf.plugin('registry');

module.exports = bookshelf;
