var async = require('async');
var DigitalOcean = require('do-wrapper');

var api = new DigitalOcean(process.env.LIBSCORE_DO_API || 'b08ea7e1c2983f66751125a816c5cf1b27cbacffefdee6d0f32a3b584c246dcf');

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
