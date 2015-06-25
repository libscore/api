exports.up = function(knex, Promise) {
  return knex.schema.createTable('histories', function(table) {
    table.integer('library_id').index().references('libraries.id');
    table.integer('count').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('histories');
};
