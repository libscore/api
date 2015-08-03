var _ = require('lodash');
var async = require('async');
var concat = require('concat-files');
var fs = require('fs');
var glob = require('glob');
var scp = require('scp2');
var DigitalOcean = require('do-wrapper');

var api = new DigitalOcean(process.env.LIBSCORE_DO_API || 'b08ea7e1c2983f66751125a816c5cf1b27cbacffefdee6d0f32a3b584c246dcf');

fs.exists('dumps', function(exists) {
  if (exists) return;
  fs.mkdirSync('dumps');
});

process.on('uncaughtException', function(err) {
  // Crawler may have restarted
  console.error('uncaughtException', err);
});

api.dropletsGetAll({}, function(err, response) {
  var droplets = response.body.droplets;
  if (response.body.links && response.body.links.pages) {
    api.dropletsGetAll({ page: 2 }, function(err, response) {
      droplets = droplets.concat(response.body.droplets);
      collect(droplets);
    });
  } else {
    collect(droplets);
  }
});


function collect(droplets) {
  async.whilst(function() {
    return droplets.length > 0;
  }, function(callback) {
    var droplet = droplets.shift();
    if (!/^crawler-\d+$/.test(droplet.name) || droplet.status !== 'active') {
      return callback(null);
    }
    download(droplet.networks.v4[1].ip_address, droplet.name, function(err) {
      if (err) {
        droplets.unshift(droplet);
        callback(null);
      } else {
        api.dropletsRequestAction(droplet.id, { type: 'power_off' }, callback);
      }
    });
  }, function() {
    console.log('Combining files');
    glob('dumps/crawler-*.json', function(err, files) {
      concat(files, 'dump.json', function() {
        console.log('All done!');
      });
    });
  });
}

function download(ip, name, callback) {
  console.log('Downloading dump from', name, ip);
  scp.scp({
    host: ip,
    username: 'root',
    privateKey: fs.readFileSync('/Users/jason/.ssh/id_rsa'),
    path: '/opt/libscore/crawler/dump.json'
  }, './dumps/' + name + '.json', function(err) {
    callback(err);
    callback = function() {};  // This horseshit lib calls callback twice
  });
}
