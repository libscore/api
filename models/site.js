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

  libraries: function() {
    return this.belongsToMany(Library);
  }
}, {
  TOP_LIMIT: 5000,

  top: function() {
    var limit = this.TOP_LIMIT;
    return this.forge().query(function(q) {
      q.orderBy('rank', 'ASC').limit(limit);
    }).fetchAll();
  }
});


module.exports = Site;
