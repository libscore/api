var _ = require('lodash');
var async = require('async');
var lineReader = require('line-reader');
var request = require('request');
var knex = require('../db/knex');
var fs = require('fs');
var Promise = require('bluebird');
var Progress = require('progress');

var LIBRARY_LIMIT = 20;
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
    console.log('Inserting new libraries');
    return Promise.all(['library', 'script'].map(function(type) {
      var libraryNames = _.union(data[type].desktop, data[type].mobile);
      return insertLibraries(ids[type], libraryNames, type);
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
    process.exit(0);
  });
});

function countLibraries(line) {
  try {
    var result = JSON.parse(line);
  } catch (ignored) {
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

function insertChunked(table, inserts) {
  var chunks = _.chunk(inserts, 500);
  return new Promise(function(resolve, reject) {
    async.eachLimit(chunks, 10, function(chunk, callback) {
      knex(table).insert(chunk).then(callback.bind(callback, null));
    }, resolve);
  });
}

function insertLibraries(ids, libraries, type) {
  var inserts = [];
  libraries.forEach(function(name) {
    if (!ids[name]) {
      insert.push({ identifier: name, name: identifier, type: type });
    }
  });
  return insertChunked('libraries', inserts);
}

function ingest(ids, libraries, platform, type) {
  var bar = new Progress('Ingest ' + platform + ' ' + type + ' [:bar] :percent :etas ', {
    incomplete: ' ',
    total: Object.keys(libraries).length,
    width: 40,
    renderThrottle: 5000
  });
  return new Promise(function(resolve, reject) {
    async.eachSeries(_.shuffle(Object.keys(libraries)), function(library, done) {
      bar.tick();
      var sites = libraries[library];
      var selectChunks = _.chunk(sites);
      async.mapSeries(selectChunks, function(chunk, callback) {
        knex('libraries_sites')
          .select('site_id')
          .whereIn('site_id', chunk)
          .andWhere('library_id', '=', ids[library])
          .andWhere('platform', '=', platform)
          .then(callback.bind(callback, null));
      }, function(err, results) {
        var rows = _.flatten(results);
        var existingIds = _.pluck(rows, 'site_id').reduce(function(memo, id) {
          memo[id] = true;
          return memo;
        }, {});
        var newIds = sites.filter(function(id) {
          return !existingIds[id];
        });
        var inserts = newIds.map(function(id) {
          return { library_id: ids[library], site_id: id, platform: platform };
        });
        var chunks = _.chunk(Object.keys(existingIds), 500);
        async.eachLimit(chunks, 10, function(chunk, callback) {
          knex('libraries_sites')
            .whereIn('site_id', chunk)
            .andWhere('platform', '=', platform)
            .andWhere('library_id', '=', ids[library])
            .update({ updated_at: updatedAt }).then(callback.bind(callback, null));
        }, function() {
          insertChunked('libraries_sites', inserts).then(done.bind(done, null));
        });
      });
    }, function() {
      resolve();
    });
  });
}
