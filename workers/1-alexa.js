// Download the Alexa top 1m sites and update the rankings

var _ = require('lodash');
var async = require('async');
var http = require('http');
var knex = require('../db/knex');
var os = require('os');
var parse = require('csv-parse');
var Progress = require('progress');
var stream = require('stream');
var unzip = require('unzip');

var LOW_PRIORITY = 1;
var HIGH_PRIORITY = 5;
var SOURCE_URL = 'http://s3.amazonaws.com/alexa-static/top-1m.csv.zip';

var pass = new stream.PassThrough();
var parser = parse();
var queue = async.priorityQueue(work, os.cpus().length);
queue.drain = drain;
var bar = new Progress('Importing [:bar] :percent :etas ', {
  incomplete: ' ',
  total: 1000000,
  width: 40
});


knex('sites').whereNotNull('rank').update({ rank: null }).then(function() {
  pass.pipe(parser);
  http.get(SOURCE_URL, getList);

  parser.on('readable', function() {
    queue.push('read', LOW_PRIORITY);
  });

  parser.on('finish', function(d) {
    parser.end();
    pass.end();
  });
});


function drain() {
  knex('sites').select('id').whereNull('rank').then(function(rows) {
    return new Promise(function(resolve, reject) {
      var chunks = _.chunk(_.pluck(rows, 'id'), 100);
      bar = new Progress('Cleaning [:bar] :percent :etas ', {
        incomplete: ' ',
        total: chunks.length,
        width: 40
      });
      async.eachLimit(chunks, os.cpus().length, function(chunk, callback) {
        knex('libraries_sites').whereIn('site_id', chunk).delete().then(function() {
          callback(null);
        });
        bar.tick();
      }, function() {
        resolve();
      });
    });
  }).then(function() {
    knex.destroy();
  });
};

function getList(response) {
  response.pipe(unzip.Parse()).on('entry', function(entry) {
    entry.pipe(pass);
  });
}

function work(task, callback) {
  if (typeof task === 'string') {
    // Read records
    var record;
    while (record = parser.read()) {
      queue.push({ rank: record[0], domain: record[1] }, HIGH_PRIORITY);
    }
    callback(null);
  } else {
    bar.tick();
    knex.raw(
      'INSERT INTO sites (domain, rank) VALUES(?, ?) ' +
      'ON CONFLICT (domain) DO UPDATE SET rank = EXCLUDED.rank'
    , [task.domain, task.rank]).then(callback);
  }
}
