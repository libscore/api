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
          title: row.domain,
          id: row.id,
          domain: row.domain,
          rank: row.rank,
          priority: 0
        }).priority(0).ttl(60*1000).save(callback);
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
