/**
 * Module dependencies.
 */
var express = require('express');
var http = require('http');
var passport = require('passport');
var util = require('util');
var utils = require('./utils');
var views = require("./views");
var api = require("./api");
var roles = require('./roles.js');
var auth = require('./auth');
var websocket = require('./websocket.js');
var config = require('./config.js');

/**
 * Express setup
 */
var app = express();
var server = http.createServer(app);

app.set('views', __dirname + '/views')
app.set('view engine', 'jade');
app.use(express.static(__dirname + '/public'));

app.use(express.logger());
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(passport.initialize());
app.use(app.router);
app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
app.use(roles.can);

websocket.initialize(server);

/**
 * Lists all users. 
 */
app.get('/1/users', [ passport.authenticate('bearer', { session: false }), roles.can('list-all-users') ], api.getUsers);

/**
* Creates new user and returns access token which can be used for
* accessing user data in future
**/
app.post('/1/users', [passport.authenticate(['basic', 'oauth2-client-password'], { session: false })], api.createUser);

/**
 * Returns user info
 */
app.get('/1/users/:userid', [ passport.authenticate('bearer', { session: false }), roles.can('get-user-info') ], api.getUser);

/**
 * Creates new file
 */
app.post('/1/users/:userid/files', [ passport.authenticate('bearer', { session: false }), roles.can('create-new-file') ], api.createUserFile);    

/**
 * Returns list of user files
 */
app.get('/1/users/:userid/files', [ passport.authenticate('bearer', { session: false }), roles.can('list-files') ], api.getUserFiles);

/* CoOPS --> */

/**
  Client asks to join the collaboration of a document. 
**/
app.get('/1/users/:userid/files/:fileid/join', [ passport.authenticate('bearer', { session: false }), roles.can('join-file') ], api.joinUserFile);

/**
 * Returns a file
 */
app.get('/1/users/:userid/files/:fileid', [ passport.authenticate('bearer', { session: false }), roles.can('get-file') ], api.getUserFile);      

/**
 * Saves a file
 */
app.put('/1/users/:userid/files/:fileid', [ passport.authenticate('bearer', { session: false }), roles.can('save-file') ], api.saveUserFile);      

/**
 * Patches a file
 */
app.patch('/1/users/:userid/files/:fileid', [ passport.authenticate('bearer', { session: false }), roles.can('save-file') ], api.patchUserFile);      

/* <-- CoOPS */

app.get('/', views.index);

// Configuration views
app.get('/setup/clients', views.setupClients); 
app.get('/setup/add-client', views.setupAddClient); 
app.get('/setup/edit-client', views.setupEditClient); 
app.post('/setup/add-client', views.setupCreateClient); 
app.post('/setup/edit-client', views.setupModifyClient); 

server.listen(config.port);
