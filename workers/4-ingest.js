var _ = require('lodash');
var lineReader = require('line-reader');
var request = require('request');
var knex = require('../db/knex');
var fs = require('fs');
var Promise = require('bluebird');
var Progress = require('progress');

var LIBRARY_LIMIT = 20;
var updatedAt = new Date();

// Find all libs that have at least 20
var libraries = {};


fs.readFile('libs.json', function(err, data) {
  libraries = JSON.parse(data);
  ingest();
})

// console.log('Counting libraries');
lineReader.eachLine('dump.json', function(line, last, callback) {
  countLibraries(line);
  if (last) {
    console.log('Found ' + Object.keys(libraries).length + ' libraries');
    libraries = _.reduce(libraries, function(memo, count, key) {
      if (count >= LIBRARY_LIMIT) {
        memo[key] = count;
      }
      return memo;
    }, {});
    console.log('Filtered to ' + Object.keys(libraries).length);
    fs.appendFile('libs.json', JSON.stringify(libraries), function() {
      process.exit(0);
    });
    // ingest();
  } else {
    callback();
  }
});

function countLibraries(line) {
  var result = JSON.parse(line);
  var combined = result.data.libs.desktop.concat(result.data.scripts.desktop, result.data.libs.mobile, result.data.scripts.mobile);
  combined.forEach(function(library) {
    if (!libraries[library]) libraries[library] = 0;
    libraries[library] += 1;
  });
}

function ingest() {
  var bar = new Progress('Importing [:bar] :percent :etas ', {
    incomplete: ' ',
    total: 1000000,
    width: 40,
    renderThrottle: 5000
  });
  console.log('Ingesting');
  lineReader.eachLine('dump.json', function(line, last, callback) {
    var arr = [];
    var add = function(type, platform, identifier) {
      if (libraries[identifier]) {
        arr.push({ type: type, platform: platform, identifier: identifier });
      }
    };
    var result = JSON.parse(line);
    bar.tick();
    result.data.libs.desktop.forEach(add.bind(add, 'library', 'desktop'));
    result.data.libs.mobile.forEach(add.bind(add, 'library', 'mobile'));
    result.data.scripts.desktop.forEach(add.bind(add, 'script', 'desktop'));
    result.data.scripts.mobile.forEach(add.bind(add, 'script', 'mobile'));
    knex('sites').update({ updated_at: updatedAt }).where('id', '=', result.id).finally(function() {
      Promise.all(arr.map(function(library) {
        return knex('libraries').select('id').where({ type: library.type, identifier: library.identifier }).then(function(rows) {
          if (rows.length > 0) {
            return Promise.resolve([rows[0].id]);
          } else {
            return knex('libraries').insert({ type: library.type, identifier: library.identifier, name: library.identifier }).returning('id');
          }
        }).then(function(rows) {
          library.id = rows[0];
          return knex('libraries_sites').where({ library_id: library.id, site_id: result.id, platform: library.platform });
        }).then(function(rows) {
          if (rows.length > 0) {
            return knex('libraries_sites').where({ library_id: library.id, site_id: result.id, platform: library.platform }).update({ updated_at: updatedAt });
          } else {
            return knex('libraries_sites').insert({ library_id: library.id, site_id: result.id, platform: library.platform, updated_at: updatedAt });
          }
        });
      })).finally(callback);
    });
  });
}
