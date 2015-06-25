exports.up = function(knex, Promise) {
  return knex.raw('CREATE EXTENSION IF NOT EXISTS "pg_trgm"')
    .then(function () {
      return knex.schema.raw('create index search_idx on "libraries" using gin(name gin_trgm_ops)');
    });
};

exports.down = function(knex, Promise) {
  return knex.raw('drop index if exists search_idx');
};
