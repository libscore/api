var os = require('os');

module.exports = {
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
    max: os.cpus().length * 2
  }
};
