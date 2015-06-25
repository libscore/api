var _ = require('lodash');
var bookshelf = require('../../db/bookshelf');
var Library = require('../../models/library');


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

function *index(next) {
  this.body = [];
};

function *search(query, next) {
  var libraries = yield Library.where('name', 'LIKE', '%' + query + '%').fetchAll({
    withRelated: {
      'history': function(query) {
        query
          .select(bookshelf.knex.raw('distinct on (library_id) *'))
          .orderBy('library_id')
          .orderBy('created_at', 'desc');
      }
    }
  })
  var results = libraries.map(function(library) {
    return {
      name: library.get('name'),
      count: library.related('history').get('count'),
      type: library.get('type')
    };
  })
  this.body = _.sortBy(results, 'count').reverse();
};

function *show(name, next) {
  var type = 'library';
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
    })
  };
};


module.exports = {
  badge: badge,
  index: index,
  search: search,
  show: show
};
