// Query our libraries for using sites and save the results

var async = require('async');
var bookshelf = require('../db/bookshelf');
var os = require('os');

var createdAt = new Date();  // Hold creation time constant

async.waterfall([
  function(callback) {
    bookshelf.knex('libraries').select('id').then(callback.bind(callback, null));
  },
  function(rows, callback) {
    async.eachLimit(rows, os.cpus().length, function(row, callback) {
      var select = bookshelf.knex('libraries_sites').select('site_id').where({ library_id: row.id }).toString();
      bookshelf.knex('histories').insert({
        library_id: row.id,
        sites: bookshelf.knex.raw('array(' + select + ')'),
        created_at: createdAt
      }).then(callback.bind(callback, null), function(err) {
        console.error('Error inserting:', row, err);
        callback(null);
      });
    }, callback);
  },
], function(err) {
  bookshelf.knex.destroy();
});
