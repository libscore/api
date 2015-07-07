var async = require('async');
var knex = require('../db/knex');
var kue = require('kue');
var moment = require('moment');
var os = require('os');
var spawn = require('child_process').spawn;

var doLauncher = require('./do-launcher');


var LIBSCORE_PATH = '/opt/libscore';
var NUM_CRAWLERS = 10;


var queue = kue.createQueue({
  redis: { auth: process.env.LIBSCORE_REDIS_PASS }
});
kue.app.set('title', 'Libscore Crawl Queue');
kue.app.listen(3000);
queue.watchStuckJobs();
queue.on('job failed', function(id, result) {
  kue.Job.get(id, function(err, job) {
    if (!err && job) {
      addSite(job.data, function() {
        job.remove();
      });
    }
  });
});


async.parallel([
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

function addSite(site, callback) {
  site.priority += 1;
  if (site.priority <= 3) {
    queue.create('website', site).priority(site.priority).ttl(60*1000).save(callback);
  }
}

function enqueueSites(callback) {
  console.log('Enqueuing sites');
  knex('sites')
    .whereNotNull('rank')
    .andWhere('updated_at', '<=', moment().subtract(24, 'hours'))
    .orderBy('rank', 'asc')
    .then(function(rows) {
      console.log('Found', rows.length, 'sites');
      async.eachSeries(rows, function(row, callback) {
        addSite({
          title: row.domain,
          id: row.id,
          domain: row.domain,
          rank: row.rank,
          priority: 0
        }, callback);
      }, callback);
    });
}

function startCrawlers(callback) {
  doLauncher(NUM_CRAWLERS, 0, callback);
}

function waitForCrawlers(callback) {
  console.log('Waiting for crawlers');
  var done = false;
  async.until(function() {
    return done;
  }, function(callback) {
    // inactive == queued
    async.every(['inactive', 'active', 'delayed'], function(name, callback) {
      queue[name+'Count'](function(err, count) {
        callback(count === 0);
      });
    }, function(every) {
      done = every;
      setTimeout(callback, 5000);
    });
  }, callback);
}
