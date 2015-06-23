// Download the Alexa top 1m sites and update our sites

var async = require('async');
var bookshelf = require('../db/bookshelf');
var http = require('https');
var os = require('os');
var parse = require('csv-parse');
var stream = require('stream');
var unzip = require('unzip');

var LOW_PRIORITY = 1;
var HIGH_PRIORITY = 5;
// var SOURCE_URL = 'http://s3.amazonaws.com/alexa-static/top-1m.csv.zip';
var SOURCE_URL = 'https://dl.dropboxusercontent.com/u/796228/top-100.csv.zip';

// 12 hours ago to compensate for possible timezone misconfigurations
var updatedAt = new Date(Date.now() - (60 * 60 * 12 * 1000));
var numParsed = 0;

var pass = new stream.PassThrough();
var parser = parse();
var queue = async.priorityQueue(work, os.cpus().length);
queue.drain = drain;
var progress = setInterval(showProgress, 1000);

pass.pipe(parser);
http.get(SOURCE_URL, getList);

parser.on('readable', function() {
  queue.push('read', LOW_PRIORITY);
});

parser.on('finish', function(d) {
  parser.end();
  pass.end();
});


function drain() {
  bookshelf.knex('sites').where('updated_at', '<', updatedAt).update({ rank: null }).finally(function() {
    bookshelf.knex.destroy();
    clearInterval(progress);
  });
};

function getList(response) {
  response.pipe(unzip.Parse()).on('entry', function(entry) {
    entry.pipe(pass);
  });
}

function showProgress() {
  console.log('Queue:', queue.length(), 'Parsed:', numParsed);
}

function work(task, callback) {
  if (typeof task === 'string') {
    // Read records
    var record;
    while (record = parser.read()) {
      numParsed += 1;
      queue.push({ rank: record[0], domain: record[1] }, HIGH_PRIORITY);
    }
    callback(null);
  } else {
    // Insert records
    // TODO use upsert when Posgres 9.5 comes out
    bookshelf.knex('sites').count('domain').where({ domain: task.domain }).then(function(rows) {
      if (rows.length > 0 && rows[0].count > 0) {
        return bookshelf.knex('sites')
          .where({ domain: task.domain })
          .update({ rank: task.rank, updated_at: new Date() });
      } else {
        return bookshelf.knex('sites')
          .insert({ domain: task.domain, rank: task.rank });
      }
    }).finally(callback);
  }
}
