var _ = require('lodash');
var bookshelf = require('../../db/bookshelf');
var parse = require('co-body');
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
  var libraries = {}, scripts = {};
  site.related('libraries').forEach(function(library) {
    var hash = library.get('type') === 'library' ? libraries : scripts;
    var platform = library.pivot.get('platform');
    // If library/script is on both mobile and desktop, only include desktop
    if (hash[library.get('name')]) {
      platform = 'desktop';
    }
    hash[library.get('name')] = {
      name: library.get('name'),
      count: library.related('history').get('count'),
      type: platform
    };
  });
  this.body = {
    url: site.get('domain'),
    rank: site.get('rank'),
    libraries: _.sortBy(_.values(libraries), 'count').reverse(),
    scripts: _.sortBy(_.values(scripts), 'count').reverse(),
    total: libraries.length,   // v1 ingestion total calculation does not include scripts
    meta: {}
  };
};

function *update(name, next) {
  /* Expected format:
    {
      libs: {
        desktop: [...],
        mobile: [...]
      },
      scripts: {
        desktop: [...],
        mobile: [...]
      }
    }
  */
  var body = yield parse.json(this);
  var libraries = [];
  var add = function(type, platform, identifier) {
    libraries.push({ type: type, platform: platform, identifier: identifier });
  };
  body.libs.desktop.forEach(add.bind(add, 'library', 'desktop'));
  body.libs.mobile.forEach(add.bind(add, 'library', 'mobile'));
  body.scripts.desktop.forEach(add.bind(add, 'script', 'desktop'));
  body.scripts.mobile.forEach(add.bind(add, 'script', 'mobile'));

  var where = isNaN(parseInt(name)) ? { domain: name } : { id: parseInt(name) };
  var updatedAt = new Date();
  yield Site.where(where).fetch().then(function(site) {
    if (!site) {
      return Promise.reject('No site found');
    }
    site.updated_at = new Date();
    return site.save();
  }).then(function(site) {
    return Promise.all(libraries.map(function(library) {
      return bookshelf.knex('libraries').select('id').where({ type: library.type, identifier: library.identifier }).then(function(rows) {
        if (rows.length > 0) {
          return Promise.resolve([rows[0].id]);
        } else {
          return bookshelf.knex('libraries').insert({ type: library.type, identifier: library.identifier, name: library.identifier }).returning('id');
        }
      }).then(function(rows) {
        library.id = rows[0];
        return bookshelf.knex('libraries_sites').where({ library_id: library.id, site_id: site.id, platform: library.platform });
      }).then(function(rows) {
        if (rows.length > 0) {
          return bookshelf.knex('libraries_sites').where({ library_id: library.id, site_id: site.id, platform: library.platform }).update({ updated_at: updatedAt });
        } else {
          return bookshelf.knex('libraries_sites').insert({ library_id: library.id, site_id: site.id, platform: library.platform, updated_at: updatedAt });
        }
      });
    }));
  }).catch(function() { }); // Ignored
  this.body = {};
}


module.exports = {
  index: index,
  show: show,
  update: update
};
