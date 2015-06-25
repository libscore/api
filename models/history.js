var bookshelf = require('../db/bookshelf');
var Library = require('./library');


var History = bookshelf.Model.extend({
  /*
  library_id: integer
  count: integer
  sites: integer[]
  created_at: timestamp
  */
  tableName: 'histories',

  library: function() {
    return this.belongsTo(Library);
  },
});


module.exports = History;
