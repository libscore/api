var _ = require('lodash');
var async = require('async');
var lineReader = require('line-reader');
var request = require('request');
var knex = require('../db/knex');
var fs = require('fs');
var os = require('os');
var Promise = require('bluebird');

var LIBRARY_LIMIT = 20;
var CHUNK_SIZE = 5000;
var CONCURRENCY = os.cpus().length;
var updatedAt = new Date();

// Find all libs that have at least 20

var data = {
  libs: {
    mobile: {},
    desktop: {}
  },
  scripts: {
    mobile: {},
    desktop: {}
  }
};
var errorCount = 0;


console.log('Counting libraries');
lineReader.eachLine('dump.json', function(line, last, callback) {
  countLibraries(line);
  if (!last) return callback();

  console.log('Found', Object.keys(data.libs.mobile).length + Object.keys(data.libs.desktop).length, 'libraries');
  console.log('Found', Object.keys(data.scripts.mobile).length + Object.keys(data.scripts.desktop).length, 'scripts');

  data = {
    library: {
      mobile: filterLibraries(data.libs, data.libs.mobile),
      desktop: filterLibraries(data.libs, data.libs.desktop),
    },
    script: {
      mobile: filterLibraries(data.scripts, data.scripts.mobile),
      desktop: filterLibraries(data.scripts, data.scripts.desktop)
    }
  }

  console.log('Filtered to', Object.keys(data.library.mobile).length + Object.keys(data.library.desktop).length, 'libraries');
  console.log('Filtered to', Object.keys(data.script.mobile).length + Object.keys(data.script.desktop).length, 'scripts');

  gatherIds().then(function(ids) {
    return Promise.all(['library', 'script'].map(function(type) {
      var libraryNames = _.union(Object.keys(data[type].desktop), Object.keys(data[type].mobile));
      return updateLibraries(ids[type], libraryNames, type);
    }));
  }).then(function() {
    console.log('Re-retrieving IDs');
    return gatherIds();
  }).then(function(ids) {
    return ingest(ids.library, data.library.desktop, 'desktop', 'library').then(function() {
      return ingest(ids.library, data.library.mobile, 'mobile', 'library');
    }).then(function() {
      return ingest(ids.script, data.script.desktop, 'desktop', 'script');
    }).then(function() {
      return ingest(ids.script, data.script.mobile, 'mobile', 'script');
    });
  }).then(function() {
    console.log(errorCount, 'errors');
    process.exit(0);
  });
});

function countLibraries(line) {
  try {
    var result = JSON.parse(line);
  } catch (ignored) {
    errorCount += 1;
    return;
  }
  ['libs', 'scripts'].forEach(function(type) {
    ['mobile', 'desktop'].forEach(function(platform) {
      result.data[type][platform].forEach(function(name) {
        if (!data[type][platform][name]) data[type][platform][name] = {};
        data[type][platform][name][result.id] = true;
      });
    });
  });
}

function filterLibraries(data, libraries) {
  return _.reduce(libraries, function(memo, sites, library) {
    var mobileCount = Object.keys(data['mobile'][library] || {}).length;
    var desktopCount = Object.keys(data['desktop'][library] || {}).length;
    if (mobileCount + desktopCount >= LIBRARY_LIMIT) {
      memo[library] = Object.keys(sites);
    }
    return memo;
  }, {});
}

function gatherIds() {
  var ids = {
    library: {},
    script: {}
  };
  return knex('libraries').select('id', 'identifier', 'type').then(function(rows) {
    rows.forEach(function(row) {
      ids[row.type][row.identifier] = row.id;
    });
    return Promise.resolve(ids);
  });
}

function ingest(ids, libraries, platform, type) {
  var total = Object.keys(libraries).length;
  function tick() {
    total -= 1;
    if (total % 100 === 0) console.log(total, platform, type, 'remaining');
  }
  return new Promise(function(resolve, reject) {
    async.eachLimit(_.shuffle(Object.keys(libraries)), CONCURRENCY, function(library, done) {
      tick();
      var queries = _.map(libraries[library], function(site) {
        return knex.raw(
          'INSERT INTO libraries_sites (site_id, platform, library_id, updated_at) VALUES (?,?,?,?) ' +
          'ON CONFLICT ON CONSTRAINT libraries_sites_library_id_site_id_platform_unique ' +
          'DO UPDATE SET updated_at = EXCLUDED.updated_at'
        , [site, platform, ids[library], updatedAt]);
      });
      async.eachSeries(_.chunk(queries, CHUNK_SIZE), function(chunk, callback) {
        var query = _.map(chunk, function(piece) {
          return piece.toString();
        }).join(';\n');
        knex.raw(query).then(callback.bind(callback, null));
      }, done.bind(done, null));
    }, resolve.bind(resolve, null));
  });
}

function deleteLibraries(ids) {
  return new Promise(function(resolve, reject) {
    async.eachLimit(ids, CONCURRENCY, function(id, callback) {
      knex('libraries_sites').where('library_id', id).delete().then(callback.bind(callback, null));
    }, resolve.bind(resolve, null));
  });
}

function insertChunked(rows) {
  var chunks = _.chunk(rows, CHUNK_SIZE);
  return new Promise(function(resolve, reject) {
    async.eachLimit(chunks, CONCURRENCY, function(chunk, callback) {
      knex('libraries').insert(chunk).then(callback.bind(callback, null));
    }, resolve.bind(resolve, null));
  });
}

function updateLibraries(ids, libraries, type) {
  ids = _.clone(ids);
  var inserts = [];
  libraries.forEach(function(name) {
    if (!ids[name]) {
      inserts.push({ identifier: name, name: name, type: type });
    } else {
      delete ids[name];
    }
  });
  console.log('Inserting', inserts.length, type);
  return insertChunked(inserts).then(function() {
    var deletes = _.values(ids);
    console.log('Deleting', deletes.length, type);
    return deleteLibraries(deletes);
  });
}
