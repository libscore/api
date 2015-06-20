'use strict';

var libraries = require('./controllers/libraries');
var sites = require('./controllers/sites');

var koa = require('koa');
var logger = require('koa-logger');
var route = require('koa-route');

var app = koa();
app.use(logger());


app.use(route.get('/v1/libraries', libraries.index));
app.use(route.get('/v1/libraries/:name', libraries.show));
app.use(route.get('/v1/sites', sites.index));
app.use(route.get('/v1/sites/:name', sites.show));
app.use(route.get('/v1/search/:query', libraries.search));

app.use(route.get('/badge/:id', libraries.badge));

app.listen(9000);


module.exports = app;
