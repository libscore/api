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

1. `su api`
1. `cd /opt/libscore/api`
1. `pm2 restart pm2.json` (This file will be present on the server)

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


### Crawling

1. Update Alexa
  - `su api` on libscore-prod
  - `cd /opt/libscore/api`
  - `node workers/1-alexa.js` (90 min)
1. Crawl Sites
  - `nohup node workers/2-crawl.js &` (8 hrs)
1. Collect & Ingest Dumps
  - `node workers/3-collect.js` (3 min)
  - `nohup node --max-old-space-size=16384 workers/4-ingest.js &` (6 hrs)
1. Calculate History
  - `node workers/5-history.js` ()
1. Cleanup
  - `mv dump.json /opt/backups/YYYY-MM-libscore.json`
  - `node workers/6-destroy.js`
  - `service redis-server restart`
1. Back Up DB
  - `su postgres` on libscore-prod
  - `cd /opt/backups`
  - `pg_dump -Fc libscore --data-only > YYYY-MM-libscore.dump` (3 min)
