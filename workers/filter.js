var _ = require('lodash');
var fs = require('fs');
var lineReader = require('line-reader');
var knex = require('./db/knex');

knex('sites').whereNotNull('rank').then(function(rows) {
  var sites = {};
  rows.forEach(function(row) {
    sites[row.domain] = row.rank;
  })
  fs.readFile('libs.json', function(err, data) {
    var libraries = JSON.parse(data);
    lineReader.eachLine('dump.json', function(line, last, callback) {
      var result = JSON.parse(line);
      result.data.libs.desktop = result.data.libs.desktop.filter(function(lib) {
        return libraries[lib] > 20;
      });
      result.data.libs.mobile = result.data.libs.mobile.filter(function(lib) {
        return libraries[lib] > 20;
      });
      result.data.scripts.desktop = result.data.scripts.desktop.filter(function(lib) {
        return libraries[lib] > 20;
      });
      result.data.scripts.mobile = result.data.scripts.mobile.filter(function(lib) {
        return libraries[lib] > 20;
      });
      result.rank = sites[result.url];
      fs.appendFile('filtered.json', JSON.stringify(result) + '\n', function() {
        if (last) process.exit(0);
        callback();
      });
    });
  });
})
