var knex = require('knex');
var conn = knex(require('./knexfile.js'));

var bookshelf = require('bookshelf')(conn);
bookshelf.plugin('registry');

module.exports = bookshelf;
