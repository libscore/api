var _ = require('lodash');
var knex = require('../../db/knex');
var moment = require('moment');
var parse = require('co-body');


function *index(next) {
  var resource = this.request.protocol + '://' + this.request.host + '/sites/';
  var sites = yield knex('sites').orderBy('rank').orderBy('rank', 'asc').limit(1000);

  var results = sites.map(function(site) {
    return { url: site.domain, rank: site.rank, resource: resource + site.domain };
  });
  this.body = {
    results: results,
    meta: {}  // Front end does not actually use this
  };
};

function *show(name, next) {
  var site = yield knex('sites').first().where('domain', '=', name);
  // The v1 behavior is uncaught error if site does not exist :(

  var results = yield knex('libraries')
    .select('libraries.id', 'libraries.name', 'libraries.type', 'libraries_sites.platform', 'histories.count')
    .innerJoin('libraries_sites', 'libraries.id', 'libraries_sites.library_id')
    .innerJoin(
      knex.raw('(' +
        knex('histories')
          .select(knex.raw('distinct on (library_id) *'))
          .orderBy('library_id')
          .orderBy('created_at', 'desc')
      + ') as histories'),
      'histories.library_id',
      'libraries_sites.library_id'
    )
    .where('libraries_sites.site_id', site.id)
    .andWhere('libraries_sites.updated_at', '>=', moment().subtract(3, 'months').toDate());

  var libraries = {}, scripts = {};
  results.forEach(function(library) {
    var hash = library.type === 'library' ? libraries : scripts;
    var platform = library.platform;
    // If library/script is on both mobile and desktop, only include desktop
    if (hash[library.name]) {
      platform = 'desktop';
    }
    hash[library.name] = {
      name: library.name,
      count: library.count,
      type: platform
    };
  });
  this.body = {
    url: site.domain,
    rank: site.rank,
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

  var site = yield knex('sites').first().where(where);
  if (site) {
    yield knex('sites').update({ updated_at: updatedAt }).where('id', '=', site.id);
    yield Promise.all(libraries.map(function(library) {
      return knex('libraries').select('id').where({ type: library.type, identifier: library.identifier }).then(function(rows) {
        if (rows.length > 0) {
          return Promise.resolve([rows[0].id]);
        } else {
          return knex('libraries').insert({ type: library.type, identifier: library.identifier, name: library.identifier }).returning('id');
        }
      }).then(function(rows) {
        library.id = rows[0];
        return knex('libraries_sites').where({ library_id: library.id, site_id: site.id, platform: library.platform });
      }).then(function(rows) {
        if (rows.length > 0) {
          return knex('libraries_sites').where({ library_id: library.id, site_id: site.id, platform: library.platform }).update({ updated_at: updatedAt });
        } else {
          return knex('libraries_sites').insert({ library_id: library.id, site_id: site.id, platform: library.platform, updated_at: updatedAt });
        }
      });
    }));
  } else {
    this.status = 500;
  }

  this.body = {};
}


module.exports = {
  index: index,
  show: show,
  update: update
};
