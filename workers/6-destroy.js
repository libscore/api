var async = require('async');
var DigitalOcean = require('do-wrapper');

var api = new DigitalOcean(process.env.LIBSCORE_DO_API);

api.dropletsGetAll({}, function(err, response) {
  var droplets = response.body.droplets;
  async.eachSeries(droplets, function(droplet, callback) {
    if (/^crawler-\d+$/.test(droplet.name) && droplet.status === 'off') {
      api.dropletsDelete(droplet.id, callback);
    } else {
      callback(null);
    }
  });
});
