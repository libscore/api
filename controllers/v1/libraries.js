var _ = require('lodash');
var knex = require('../../db/knex');
var moment = require('moment');


function *badge(name, next) {
  var library = yield knex('libraries')
    .innerJoin('histories', 'libraries.id', 'histories.library_id')
    .where({ name: name, type: 'library' })
    .orderBy('histories.created_at', 'desc').limit(1).first();
  this.status = 301;
  this.redirect('http://img.shields.io/badge/libscore-' + library.count + '-brightgreen.svg?style=flat-square');
};

function *index(type, next) {
  var resource = this.request.protocol + '://' + this.request.host + '/' + type + '/';
  if (type === 'libraries') {
    type = 'library';
  } else if (type === 'scripts') {
    type = 'script';
  } else {
    return yield next;
  }
  var libraries = yield knex.select('libraries.name', 'histories.count').from(
    knex.raw(
      "(" +
      knex('histories')
        .select(knex.raw('distinct on (library_id) *'))
        .orderBy('library_id')
        .orderBy('created_at', 'desc').toString() +
      ") as histories"
    )
  ).innerJoin('libraries', 'libraries.id', '=', 'histories.library_id')
    .where({ type: type })
    .orderBy('count', 'desc')
    .limit(1000);
  this.body = {
    results: libraries.map(function(library) {
      var result = {
        count: [library.count],
        resource: resource + library.name,
        github: ""
      };
      result[type] = library.name
      return result;
    }),
    meta: {}
  };
};

function *search(query, next) {
  var libraries = yield knex('libraries')
    .select('libraries.name', 'libraries.identifier', 'libraries.type', 'histories.count')
    .join('histories', 'libraries.id', 'histories.library_id')
    .where('histories.created_at', 'in', knex('histories').max('created_at'))
    .andWhere('libraries.name', 'ILIKE', knex.raw('?', '%' + query + '%'))
    .orderBy('histories.count', 'desc')
    .limit(25);
  var results = libraries.map(function(library) {
    return {
      name: library.identifier,
      count: library.count,
      type: library.type
    };
  })
  this.body = _.sortBy(results, 'count').reverse();
};

function *show(type, name, next) {
  if (type === 'libraries') {
    type = 'library';
  } else if (type === 'scripts') {
    type = 'script';
  } else {
    return yield next;
  }
  var resource = this.request.protocol + '://' + this.request.host + '/sites/';
  var library = yield knex('libraries').where({ name: name, type: type }).first();
  this.body = {
    github: "",
    meta: {}
  }
  if (library) {
    var sites = yield knex('sites')
      .innerJoin('libraries_sites', 'sites.id', 'libraries_sites.site_id')
      .where('libraries_sites.library_id', '=', library.id)
      .andWhere('libraries_sites.updated_at', '>=', moment().subtract(3, 'months').toDate())
      .orderBy('rank', 'asc')
      .limit(1000);
    var histories = yield knex('histories')
      .where('library_id', '=', library.id)
      .orderBy('created_at', 'desc')
      .limit(6);      // 6 months
    this.body.count = _.pluck(histories, 'count');
    this.body.sites = sites.map(function(site) {
      return {
        url: site.domain,
        rank: site.rank,
        resource: resource + site.domain
      }
    });
  } else {
    this.body.count = [];
    this.body.sites = [];
  }
};


module.exports = {
  badge: badge,
  index: index,
  search: search,
  show: show
};
