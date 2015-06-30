exports.up = function(knex, Promise) {
  return Promise.all([
    knex.schema.table('histories', function(table) {
      table.index('count');
      table.index('created_at');
    }),
    knex.schema.table('libraries_sites', function(table) {
      table.index('updated_at');
    }),
    knex.schema.table('sites', function(table) {
      table.index('updated_at');
    })
  ]);
};

exports.down = function(knex, Promise) {
  return Promise.all([
    knex.schema.table('histories', function(table) {
      table.dropIndex('count');
      table.dropIndex('created_at');
    }),
    knex.schema.table('sites', function(table) {
      table.dropIndex('updated_at');
    })
  ]);
};
