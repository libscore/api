// Query our libraries for using sites and save the results

var async = require('async');
var bookshelf = require('../db/bookshelf');
var os = require('os');
var Progress = require('progress');

var CREATED_AT = new Date();  // Hold creation time constant

bookshelf.knex('libraries').select('id').then(function(rows) {
  var bar = new Progress('Calculating [:bar] :percent :etas ', {
    incomplete: ' ',
    total: rows.length,
    width: 40
  });
  async.eachLimit(rows, os.cpus().length, function(row, callback) {
    bar.tick();
    var count = bookshelf.knex('libraries_sites').count('*').where({ library_id: row.id }).toString();
    bookshelf.knex('histories').insert({
      library_id: row.id,
      count: bookshelf.knex.raw('COALESCE((' + count + '), 0)'),
      created_at: CREATED_AT
    }).then(callback.bind(callback, null), function(err) {
      console.error('Error inserting:', row, err);
      callback(null);
    });
  }, function(err) {
    bookshelf.knex.destroy();
  });
});
