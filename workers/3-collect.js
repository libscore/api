// TODO add public key to crawler-template

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

var allDroplets = [];

process.on('uncaughtException', function(err) {
  // Crawler may have restarted
  console.error('uncaughtException', err)
  setTimeout(function() {
    collect(allDroplets);
  }, 5000);
});

api.dropletsGetAll({}, function(err, response) {
  allDroplets = response.body.droplets;
  collect(allDroplets);
});


function collect(droplets) {
  droplets = _.clone(droplets);
  async.eachSeries(droplets, function(droplet, callback) {
    if (!/^crawler-\d+$/.test(droplet.name)) return callback(null);
    var ip = droplet.networks.v4[1].ip_address;
    console.log('Downloading dump from', droplet.name, ip);
    download(ip, droplet.name, function() {
      allDroplets.splice(allDroplets.indexOf(droplet), 1);
      api.dropletsDelete(droplet.id, callback);
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
  scp.scp({
    host: ip,
    username: 'root',
    privateKey: fs.readFileSync('/Users/jason/.ssh/id_rsa'),
    path: '/opt/libscore/crawler/dump.json'
  }, './dumps/' + name + '.json', function(err) {
    if (err) {
      console.error('Download error', err);
      throw err;  // This horseshit lib calls callback twice
    } else {
      callback(null);
    }
  });
}
