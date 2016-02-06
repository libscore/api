'use strict';

var koa = require('koa');
var cors = require('koa-cors');
var knex = require('./db/knex');
var logger = require('koa-logger');
var route = require('koa-route');
var v1 = {
  libraries: require('./controllers/v1/libraries'),
  sites: require('./controllers/v1/sites')
};

var app = koa();
app.use(cors());
app.use(logger());

var lastHistory;

app.use(function *(next) {
  var twoWeeks = 60*60*24*14;
  if (lastHistory == null) {
    lastHistory = yield knex('histories').orderBy('created_at', 'desc').limit(1).first();
  }
  this.set('Cache-Control', 'public,max-age=' + twoWeeks + ',s-maxage=' + twoWeeks);
  this.lastModified = new Date(lastHistory.created_at);
  try {
    yield next;
  } catch (err) {
    this.app.emit('error', err, this);
    this.status = err.status || 500;
    this.body = 'Internal server error';
    if (err.message === 'Pool is destroyed') {
      process.nextTick(function() {
        process.exit(1);
      })
    }
  }
});

app.use(route.get('/v1/:type', v1.libraries.index));
app.use(route.get('/v1/:type/:name', v1.libraries.show));
app.use(route.get('/v1/sites', v1.sites.index));
app.use(route.get('/v1/sites/:name', v1.sites.show));
app.use(route.post('/v1/sites/:name', v1.sites.update));
app.use(route.get('/v1/search/:query', v1.libraries.search));

app.use(route.get('/badge/:name.svg', v1.libraries.badge));

app.listen(9000);


module.exports = app;
