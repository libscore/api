var _ = require('lodash');
var bookshelf = require('../../db/bookshelf');
var Site = require('../../models/site');


function *index(next) {
  var sites = yield Site.top();
  var resource = this.request.protocol + '://' + this.request.host + '/sites/';
  var results = sites.map(function(site) {
    return { url: site.get('domain'), rank: site.get('rank'), resource: resource + site.get('domain') };
  });
  this.body = {
    results: results,
    meta: {}  // Front end does not actually use this
  };
};

function *show(name, next) {
  var site = yield Site.where({ domain: name }).fetch({
    withRelated: {
      'libraries': false,
      'libraries.history': function(query) {
        query
          .select(bookshelf.knex.raw('distinct on (library_id) *'))
          .orderBy('library_id')
          .orderBy('created_at', 'desc');
      }
    }
  });
  var libraries = [], scripts = [];
  site.related('libraries').forEach(function(library) {
    var row = {
      name: library.get('name'),
      count: library.related('history').get('count'),
      type: (library.pivot.get('platform') === 'mobile' ? 'mobile' : 'desktop')  // 'both' converted to 'desktop'
    };
    (library.get('type') === 'library' ? libraries : scripts).push(row);
  });
  this.body = {
    url: site.get('domain'),
    rank: site.get('rank'),
    libraries: _.sortBy(libraries, 'count').reverse(),
    scripts: _.sortBy(scripts, 'count').reverse(),
    total: libraries.length,   // v1 ingestion total calculation does not include scripts
    meta: {}
  };
};


module.exports = {
  index: index,
  show: show
};
