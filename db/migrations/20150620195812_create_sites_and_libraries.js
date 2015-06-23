exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('libraries', function(table) {
      table.increments('id').primary();
      table.text('name').notNullable();
      table.string('identifier').notNullable().unique();
      table.string('website');
      table.string('repository');
      table.enu('type', ['library', 'script', 'server']);
    })
    .createTable('sites', function(table) {
      table.increments('id').primary();
      table.string('domain').unique().notNullable();
      table.integer('rank');
      table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    })
    .createTable('libraries_sites', function(table) {
      table.integer('library_id').references('libraries.id');
      table.integer('site_id').references('sites.id');
      table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    }); /*.then(function() {      // TODO when we Dockerize, we can add this
      return knex.schema.raw('create index search_idx on "libraries" using gist(name gist_trgm_ops)')
    });*/
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTable('libraries_sites')
    .dropTable('libraries')
    .dropTable('sites');
};