var os = require('os');

var config = {
  client: 'postgres',
  debug: process.env.NODE_ENV !== 'production',
  connection: {
    database: 'libscore',
    user: process.env.LIBSCORE_DB_USER,
    password: process.env.LIBSCORE_DB_PASS
  },
  migrations: {
    tableName: 'knex_migrations'
  },
  pool: {
    min: 0,
    max: 20
  }
};

// Only way to get knex to work in app and migration when
// NODE_ENV is either defined or not
config.development = config;
config.production = config;

module.exports = config;
