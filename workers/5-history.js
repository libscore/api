// Query our libraries for using sites and save the results

var async = require('async');
var knex = require('../db/knex');
var moment = require('moment');
var os = require('os');
var Progress = require('progress');

var CREATED_AT = new Date();  // Hold creation time constant


knex('libraries').select('id').then(function(rows) {
  var bar = new Progress('Calculating [:bar] :percent :etas ', {
    incomplete: ' ',
    total: rows.length,
    width: 40
  });
  async.eachLimit(rows, os.cpus().length, function(row, callback) {
    bar.tick();
    var distinct = knex('libraries_sites')
      .distinct('site_id')
      .where({ library_id: row.id })
      .andWhere('libraries_sites.updated_at', '>=', moment().subtract(14, 'days').toDate());
    var count = knex(knex.raw('(' + distinct + ') as temp')).count('site_id');
    knex('histories').insert({
      library_id: row.id,
      count: knex.raw('COALESCE((' + count + '), 0)'),
      created_at: CREATED_AT
    }).then(callback.bind(callback, null), function(err) {
      console.error('Error inserting:', row, err);
      callback(null);
    });
  }, function() {
    process.exit(0);
  });
});
