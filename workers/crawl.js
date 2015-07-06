var async = require('async');
var DigitalOcean = require('do-wrapper');
var knex = require('../db/knex');
var kue = require('kue');
var moment = require('moment');
var os = require('os');
var spawn = require('child_process').spawn;


var IMAGE_ID = process.env.LIBSCORE_DO_IMAGE_ID;
var SSH_KEY = process.env.LIBSCORE_DO_SSH_ID;
var LIBSCORE_PATH = '/opt/libscore';
var NUM_CRAWLERS = 40;
var START_TIME = Date.now();


var queue = kue.createQueue({
  redis: { auth: process.env.LIBSCORE_REDIS_PASS }
});
kue.app.set('title', 'Libscore Crawl Queue');
kue.app.listen(3000);
queue.watchStuckJobs();
var api = new DigitalOcean(process.env.LIBSCORE_DO_API);

var crawlers = [];


async.parallel([
  enqueueSites,
  startCrawlers,
  waitForCrawlers
], function(err) {
  console.log("Crawler series error", err);
  queue.shutdown(5000, function() {
    shutdownCrawlers(function() {
      console.log('Done!');
      process.exit(0);
    });
  });
});


function enqueueSites(callback) {
  console.log('Enqueuing sites');
  knex('sites')
    .whereNotNull('rank')
    .andWhere('updated_at', '<=', moment().subtract(24, 'hours'))
    .orderBy('rank', 'asc')
    .then(function(rows) {
      console.log('Found', rows.length, 'sites');
      async.eachSeries(rows, function(row, callback) {
        queue.create('website', {
          id: row.id,
          domain: row.domain,
          rank: row.rank
        }).attempts(3).backoff({ delay: 60*1000, type: 'fixed' }).save(callback);
      }, callback);
    });
}

function shutdownCrawlers(callback) {
  console.log('Shutting Down Crawlers');
  async.each(crawlers, function(crawler) {
    api.dropletsDelete(crawler, callback);
  }, callback);
}

function startCrawlers(callback) {
  console.log('Starting crawlers');
  async.timesSeries(NUM_CRAWLERS, function(i, next) {
    api.dropletsCreate({
      name: 'crawler-' + i,
      region: 'sfo1',
      size: '64GB',
      image: IMAGE_ID,
      private_networking: true,
      ssh_keys: [SSH_KEY]
    }, function(err, response) {
      console.log('DO', err, response.body);
      next(null);
    });
  }, callback);
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
