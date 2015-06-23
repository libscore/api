var bookshelf = require('../db/bookshelf');
var Site = require('./site');

var Library = bookshelf.Model.extend({
  tableName: 'libraries',
  sites: function() {
    return this.belongsToMany(Site);
  }
});


module.exports = Library;
