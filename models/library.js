var bookshelf = require('../db/bookshelf');
var Site = require('./site');


var Library = bookshelf.Model.extend({
  /*
  id: integer
  name: text
  identifier: string
  website: string
  repository: string
  type: enum ['library', 'script', 'server']
  */
  tableName: 'libraries',
  sites: function() {
    return this.belongsToMany(Site);
  }
});


module.exports = Library;
