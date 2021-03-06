exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('libraries', function(table) {
      table.increments('id').primary();
      table.text('name').notNullable();
      table.string('identifier').notNullable().unique();
      table.string('site');
      table.enu('type', ['library', 'script', 'server']);
    })
    .createTable('sites', function(table) {
      table.increments('id').primary();
      table.string('domain').unique().notNullable();
      table.integer('rank').index();
      table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    })
    .createTable('libraries_sites', function(table) {
      table.integer('library_id').references('libraries.id').index();
      table.integer('site_id').references('sites.id').index();
      table.enu('platform', ['desktop', 'mobile']);
      table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
      table.unique(['library_id', 'site_id', 'platform']);
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTable('libraries_sites')
    .dropTable('libraries')
    .dropTable('sites');
};
