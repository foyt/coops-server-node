var http = require('http');
var express = require('express');
var app = express();
var server = http.createServer(app);

var rest = require('./rest.js');
var websocket = require('./websocket.js');

var serverPort = 8080;

app.configure(function () {
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler({ 
    dumpExceptions: true, 
    showStack: true 
  }));
}); 

rest.initialize(app);
websocket.initialize(server);
server.listen(serverPort);

// TODO: More sophisticated extension system
rest.on("fileJoin", function (event) {
  event.setProperty("webSocketUrl", 'ws://' + event.getRequest().header('host'));
});