var bookshelf = require('../db/bookshelf');
var History = require('./history');
var Site = require('./site');


var Library = bookshelf.Model.extend({
  /*
  id: integer
  name: text
  identifier: string
  site: string
  type: enum ['library', 'script', 'server']
  */
  tableName: 'libraries',

  history: function() {
    return this.hasOne('History');
  },

  histories: function() {
    return this.hasMany('History');
  },

  sites: function() {
    return this.belongsToMany('Site');
  }
});


module.exports = bookshelf.model('Library', Library);
