var _ = require('lodash');
var bookshelf = require('../../db/bookshelf');
var Library = require('../../models/library');
var History = require('../../models/history');


function *badge(name, next) {
  var library = yield Library.where({ name: name, type: 'library' }).fetch({
    withRelated: {
      'history': function(query) {
        query.orderBy('created_at', 'desc').limit(1);
      }
    }
  });
  this.status = 301;
  var count = library.related('history').get('count');
  this.redirect('http://img.shields.io/badge/libscore-' + count + '-brightgreen.svg?style=flat-square');
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
  var libraries = yield bookshelf.knex.select('libraries.name', 'sub.count').from(
    bookshelf.knex.raw(
      "(" +
      bookshelf.knex('histories')
        .select(bookshelf.knex.raw('distinct on (library_id) *'))
        .orderBy('library_id')
        .orderBy('created_at', 'desc').toString() +
      ") as sub"
    )
  ).innerJoin('libraries', 'libraries.id', '=', 'sub.library_id')
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
  var libraries = yield bookshelf.knex('libraries')
    .select('libraries.name', 'libraries.type', 'histories.count')
    .join('histories', 'libraries.id', 'histories.library_id')
    .where('histories.created_at', 'in', bookshelf.knex('histories').max('created_at'))
    .andWhere('libraries.name', 'ILIKE', bookshelf.knex.raw('?', '%' + query + '%'))
    .orderBy('histories.count', 'desc')
    .limit(25);
  var results = libraries.map(function(library) {
    return {
      name: library.name,
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
  var library = yield Library.where({ name: name, type: type }).fetch({
    withRelated: {
      'sites': function(query) {
        query.orderBy('rank', 'asc').limit(1000);
      },
      'histories': function(query) {
        query.orderBy('created_at', 'desc').limit(6);     // 6 months
      }
    }
  });
  this.body = {
    count: library.related('histories').pluck('count'),
    sites: library.related('sites').map(function(site) {
      return {
        url: site.get('domain'),
        rank: site.get('rank'),
        resource: resource + site.get('domain')
      }
    }),
    meta: {}
  };
};


module.exports = {
  badge: badge,
  index: index,
  search: search,
  show: show
};
