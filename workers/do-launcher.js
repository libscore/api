var async = require('async');
var DigitalOcean = require('do-wrapper');

var IMAGE_ID = process.env.LIBSCORE_DO_IMAGE_ID;
var SSH_KEY = process.env.LIBSCORE_DO_SSH_ID;

var api = new DigitalOcean(process.env.LIBSCORE_DO_API);
var regions = ['sfo1', 'nyc1', 'nyc2', 'nyc3'];

module.exports = function(num, start, callback) {
  if (start == null) start = 0;
  console.log('Starting ' + num + ' crawlers');
  async.timesSeries(num, function(i, next) {
    var region = regions.shift();
    regions.push(region);
    api.dropletsCreate({
      name: 'crawler-' + (start + i),
      region: region,
      size: '64GB',
      image: IMAGE_ID,
      private_networking: true,
      ssh_keys: [SSH_KEY]
    }, function(err, response) {
      console.log('DO', err);
      setTimeout(next, 5000);
    });
  }, function(err) {
    if (callback != null) {
      callback(err);
    }
  });
}
