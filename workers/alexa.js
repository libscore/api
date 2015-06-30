// Download the Alexa top 1m sites and update the rankings

var async = require('async');
var bookshelf = require('../db/bookshelf');
var http = require('http');
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


bookshelf.knex('sites').whereNotNull('rank').update({ rank: null }).then(function() {
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
  bookshelf.knex.destroy();
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
    // Insert records
    // TODO use upsert when Posgres 9.5 comes out
    bookshelf.knex('sites').count('domain').where({ domain: task.domain }).then(function(rows) {
      bar.tick();
      if (rows.length > 0 && rows[0].count > 0) {
        return bookshelf.knex('sites').where({ domain: task.domain }).update({ rank: task.rank });
      } else {
        return bookshelf.knex('sites').insert({ domain: task.domain, rank: task.rank });
      }
    }).finally(callback);
  }
}
