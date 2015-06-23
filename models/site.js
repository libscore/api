var bookshelf = require('../db/bookshelf');
var Library = require('./library');

var Site = bookshelf.Model.extend({
  /*
  id: integer
  domain: string
  rank: integer (null if > 1m)
  updated_at: timestamp
  */
  tableName: 'sites',

  sites: function() {
    return this.belongsToMany(Library);
  },

  updatedAt: function() {
    return this.updated_at;
  }
});


module.exports = Site;
