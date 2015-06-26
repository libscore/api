# Libscore API Server

## Dependencies

- Postgres
- NodeJS

## Development

1. Set LIBSCORE_DB_USER and LIBSCORE_DB_PASS environment variables
1. `npm start`


## Production

### Installation

1. `npm install -g pm2`
1. `npm install -g knex`

### Running

1. `pm2 start --node-args"--harmony" app.js -i max`

### Deploying

API

1. SSH into server (libscore-prod on Digital Ocean)
1. `su api`
1. `cd /opt/libscore/api`
1. `git pull origin master`
1. `npm install`
1. `knex migrate:latest --knexfile db/knexfile.js`
1. `pm2 restart pm2.json` (This file will be present on the server)

Web

1. SSH into server (libscore-prod on Digital Ocean)
1. `su web`
1. `cd /opt/libscore/private`
1. `git pull origin master`
1. Log into Cloudflare
1. Invalidate cache for front end assets
