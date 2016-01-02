var async = require('async');
var knex = require('../db/knex');
var kue = require('kue');
var moment = require('moment');
var os = require('os');
var spawn = require('child_process').spawn;

var doLauncher = require('./do-launcher');


var LIBSCORE_PATH = '/opt/libscore';
var NUM_CRAWLERS = 32;


var queue = kue.createQueue({
  redis: { auth: process.env.LIBSCORE_REDIS_PASS }
});
kue.app.set('title', 'Libscore Crawl Queue');
kue.app.listen(3000);
queue.watchStuckJobs();
queue.on('job failed', function(id, result) {
  kue.Job.get(id, function(err, job) {
    if (err || !job) return;
    job.data.priority += 1;
    if (job.data.priority < 5) {
      var newJob = queue.create('website', job.data).priority(job.data.priority).ttl(60*1000);
      process.nextTick(function() {
        job.remove();
        newJob.save();
      });
    }
  });
});


async.series([
  enqueueSites,
  startCrawlers,
  waitForCrawlers
], function(err) {
  console.log("Crawler series error", err);
  queue.shutdown(5000, function() {
    console.log('Done!');
    process.exit(0);
  });
});

function enqueueSites(callback) {
  console.log('Enqueuing sites');
  knex('sites')
    .whereNotNull('rank')
    .orderBy('rank', 'asc')
    .then(function(rows) {
      console.log('Found', rows.length, 'sites');
      async.eachLimit(rows, 10, function(row, callback) {
        queue.create('website', {
          title: row.domain,
          id: row.id,
          domain: row.domain,
          rank: row.rank,
          priority: 0
        }).priority(0).ttl(90*1000).save(callback);
      }, callback);
    });
}

function startCrawlers(callback) {
  doLauncher(NUM_CRAWLERS, 0, callback);
}

function waitForCrawlers(callback) {
  console.log('Waiting for crawlers');
  async.during(function(callback) {
    async.every(['inactive', 'active', 'delayed'], function(name, callback) {
      queue[name+'Count'](function(err, count) {
        callback(count <= 25);
      });
    }, function(every) {
      callback(null, every);
    });
  }, function(callback) {
    setTimeout(callback, 5000);   // TODO change to slower
  }, callback);
}
