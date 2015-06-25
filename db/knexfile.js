module.exports = {
  client: 'postgresql',
  debug: true,
  connection: {
    database: 'libscore',
  },
  migrations: {
    tableName: 'knex_migrations'
  }
}
