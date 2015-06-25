var  _ = require('lodash');
var Site = require('../models/site');


function *index(next) {
  var sites = yield Site.top();
  var resource = this.request.protocol + '://' + this.request.host + '/sites/'
  var results = _.map(sites.toJSON(), function(site) {
    return { url: site.domain, rank: site.rank, resource: resource + site.domain }
  });
  this.body = {
    results: results,
    meta: {}  // Front end does not actually use this
  };
};

function *show(name, next) {
  var site = yield Site.forge().where({ domain: name });
  this.body = {};
};


module.exports = {
  index: index,
  show: show
};
