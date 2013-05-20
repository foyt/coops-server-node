/**
 * Module dependencies.
 */
var express = require('express');
var http = require('http');
var https = require('https');
var fs = require('fs');

var passport = require('passport');
var util = require('util');
var views = require("./views");
var api = require("./api");
var roles = require('./roles.js');
var auth = require('./auth');
var websocket = require('./websocket.js');

/**
 * Express setup
 */
var app = express();
var unsecureServer = null;
var secureServer = null;

if (process.env.COOPS_UNSECURE_PORT) {
  unsecureServer = http.createServer(app);
  unsecureServer.listen(process.env.COOPS_UNSECURE_PORT);
  console.log("Listening unsecure port " + process.env.COOPS_UNSECURE_PORT);
} 

if (process.env.COOPS_SECURE_PORT && process.env.COOPS_SECURE_CERT && process.env.COOPS_SECURE_CERT_KEY) {
  var certificate = { 
    key: fs.readFileSync(process.env.COOPS_SECURE_CERT_KEY).toString(), 
    cert: fs.readFileSync(process.env.COOPS_SECURE_CERT).toString() 
  };

  secureServer = https.createServer(certificate, app);
  secureServer.listen(process.env.COOPS_SECURE_PORT);
  console.log("Listening secure port " + process.env.COOPS_SECURE_PORT);
}

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

websocket.initialize(unsecureServer, secureServer);

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

/**
 * Returns file users
 */
app.get('/1/users/:userid/files/:fileid/users', [ passport.authenticate('bearer', { session: false }), roles.can('get-file-users') ], api.getFileUsers);      

/**
 * Saves file users
**/
app.post('/1/users/:userid/files/:fileid/users', [ passport.authenticate('bearer', { session: false }), roles.can('update-file-users') ], api.updateFileUsers);      

app.get('/', views.index);

// Configuration views

app.get('/setup/clients', [ passport.authenticate('admin', { session: false }) ], views.setupClients); 
app.get('/setup/add-client', [ passport.authenticate('admin', { session: false }) ], views.setupAddClient); 
app.get('/setup/edit-client', [ passport.authenticate('admin', { session: false }) ], views.setupEditClient); 
app.post('/setup/add-client', [ passport.authenticate('admin', { session: false }) ], views.setupCreateClient); 
app.post('/setup/edit-client', [ passport.authenticate('admin', { session: false }) ], views.setupModifyClient); 