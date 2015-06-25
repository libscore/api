module.exports = {
  client: 'postgresql',
  debug: true,
  connection: {
    database: 'libscore',
    user: 'jason'
  },
  migrations: {
    tableName: 'knex_migrations'
  }
}
