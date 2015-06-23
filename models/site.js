var bookshelf = require('../db/bookshelf');
var Library = require('./library');

var Site = bookshelf.Model.extend({
  tableName: 'sites',
  sites: function() {
    return this.belongsToMany(Library);
  }
});


module.exports = Site;
