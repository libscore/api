module.exports = {
  client: 'postgresql',
  connection: {
    database: 'libscore',
  },
  migrations: {
    tableName: 'knex_migrations'
  }
}
