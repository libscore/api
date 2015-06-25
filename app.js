'use strict';

var koa = require('koa');
var logger = require('koa-logger');
var route = require('koa-route');
var v1 = {
  libraries: require('./controllers/v1/libraries');
  sites: require('./controllers/v1/sites');
};

var app = koa();
app.use(logger());


app.use(route.get('/v1/libraries', v1.libraries.index));
app.use(route.get('/v1/libraries/:name', v1.ibraries.show));
app.use(route.get('/v1/sites', v1.sites.index));
app.use(route.get('/v1/sites/:name', v1.sites.show));
app.use(route.get('/v1/search/:query', v1.libraries.search));


app.use(route.get('/badge/:id', v1.libraries.badge));

app.listen(9000);


module.exports = app;
