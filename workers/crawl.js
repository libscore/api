var async = require('async');
var bookshelf = require('../db/bookshelf');
var DigitalOcean = require('do-wrapper');
var kue = require('kue');
var os = require('os');
var spawn = require('child_process').spawn;


var IMAGE_ID = process.env.LIBSCORE_CRAWLER_IMAGE;
var LOCAL_IP = os.networkInterfaces().eth0[0].address;
var LIBSCORE_PATH = '/opt/libscore/crawler';
var NUM_CRAWLERS = 2;
var START_TIME = Date.now();


var queue = kue.createQueue({
  redis: { auth: process.env.LIBSCORE_REDIS_PASS }
});
kue.app.set('title', 'Libscore Crawl Queue');
kue.app.listen(3000);
var api = new DigitalOcean(process.env.LIBSCORE_DO_API);


async.series([
  runScript.bind(runScript, 'alexa.js'),
  enqueueSites,
  startCrawlers,
  waitForCrawlers,
  runScript.bind(runScript, 'history.js')
], function(err) {
  queue.shutdown(5000, function() {
    console.log('Done!');
    process.exit(0);
  });
});


function enqueueSites(callback) {
  bookshelf.knex('sites').select('id', 'domain', 'rank').whereNotNull('rank').then(function(rows) {
    async.eachLimit(rows, 50, function(row, callback) {
      queue.create('website', {
        id: row.id,
        domain: row.domain,
        rank: row.rank
      }).attempts(3).backoff({ delay: 60*1000, type: 'fixed' }).save(callback);
    }, callback);
  });
}

function runScript(name, callback) {
  var child = spawn('node', [name], { stdio: 'inherit'});
  child.on('close', function(code) {
    callback(code === 0);
  });
}

function startCrawlers(callback) {
  async.timesSeries(NUM_CRAWLERS, function(i, next) {
    api.dropletsCreate({
      name: 'crawler-' + i,
      region: 'sfo1',
      size: '64GB',
      image: IMAGE_ID,
      private_networking: true,
      user_data: [
        '#!/bin/bash',
        '',
        'apt-get update',
        'apt-get upgrade'
        'git clone git@github.com:libscore/crawler.git ' + LIBSCORE_PATH,
        'cd ' + LIBSCORE_PATH,
        'npm install',
        'node ' + LIBSCORE_PATH + '/runner.js' + START_TIME + ' ' + LOCAL_IP
      ].join('')
    }, next.bind(next, null));
  }, callback);
}

function waitForCrawlers(callback) {
  var done = false;
  async.until(function() {
    return done;
  }, function(callback) {
    async.every(['queued', 'active', 'delayed'], function(name, callback) {
      queue[name+'Count'](function(err, count) {
        callback(count === 0);
      });
    }, function(every) {
      done = every;
      setTimeout(callback, 5000);
    });
  }, callback);
}
