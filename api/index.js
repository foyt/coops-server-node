(function() {
  var async = require('async');
  var db = require("../db");
  var utils = require("../utils");
  var _ = require('underscore');
  
  var events = require('events');
  var api = require('./api.js')
    .setProtocolVersion("1.0.0draft1")
    .setAlgorithms("dmp")
    .setExtensions([
      'websockets',
      'x-http-method-override'
    ]).build();
  
  var extensionEventEmitter = new events.EventEmitter();
  var clientIdCounter = new Date().getTime();
    
  function ApiExtensionEvent(request, data) {
    this._request = request;
    this._data = data||{};
  };
  
  ApiExtensionEvent.prototype = Object.create(null, {
    constructor: {
      value: ApiExtensionEvent,
      enumerable: false
    },
    getRequest: {
      value: function () {
        return this._request;
      }
    },
    setProperty: {
      value: function (name, value) {
        this._data[name] = value;
      } 
    },
    getData: {
      value: function () {
        return this._data;
      }
    }
  });
  
  // Exports
  
  module.exports.createUser = function (req, res) {
    var name = req.body['name'];
    var client = req.user;
    
    var user = new db.model.User();
    user.name = name;
    user.save(function (err, newUser) {
      if (err) {
        res.send(err, 500);
      } else {
        var expireTime = 1000 * 60 * 60 * 24;
        var accessToken = new db.model.AccessToken();
        accessToken.token = utils.uid(256);
        accessToken.refreshToken = utils.uid(256);
        accessToken.userId = newUser._id;
        accessToken.clientId = client._id;
        accessToken.expires = expireTime + new Date().getTime();
        
        accessToken.save(function (err, newAccessToken) {
          var event = new ApiExtensionEvent(req, {
            "user_id": newAccessToken.userId,
            "access_token": {
              "access_token": newAccessToken.token,
              "token_type":"Bearer",
              "expires_in":  newAccessToken.expires - new Date().getTime(),
              "refresh_token": newAccessToken.refreshToken
            } 
          });
                
          extensionEventEmitter.emit("createUser", event);
          
          api.sendResponse(res,
            api.createResponseBuilder()
              .setStatus(api.STATUS_OK)
              .setResponse(event.getData())
              .build()
          );
        });
      }
    });   
  };

  module.exports.getUsers = function(req, res) {
    db.model.User.find(function (err, users) {
      if (err) {
        res.send(err, 500);
      } else {
        var event = new ApiExtensionEvent(req, {
          userIds: _.pluck(users, "_id")
        });
        
        extensionEventEmitter.emit("listUsers", event);
        api.sendResponse(res,
          api.createResponseBuilder()
            .setStatus(api.STATUS_OK)
            .setResponse(event.getData())
            .build()
        );
      }
    });
  };
  
  module.exports.getUser = function(req, res) {
    var userId = req.params.userid;
    
    db.model.User.findOne({ _id: userId }, function (err, user) {
      if (err) {
        res.send(err, 500);
      } else {
        var event = new ApiExtensionEvent(req, {
          userId: user._id,
          name: user.name
        });
              
        extensionEventEmitter.emit("getUser", event);
        api.sendResponse(res,
          api.createResponseBuilder()
            .setStatus(api.STATUS_OK)
            .setResponse(event.getData())
            .build()
        );
      }
    });
  };
  
  module.exports.createUserFile = function(req, res) {
    var userId = req.params.userid;
    var name = req.body['name'];
    var content = '<p>Test</p>';
    var contentType = 'text/html';
    // TODO: name => post parameter
    // TODO: Content
    // TODO: CotnentType
    
    new db.model.File({ name: name, revisionNumber: 0 }).save(function (err, file) {
      if (err) {
        res.send(err, 500);
      } else {
        new db.model.FileContent({ fileId: file._id, content: content, contentType: contentType }).save(function (err, fileContent) {
          if (err) {
            res.send(err, 500);
          } else {
            new db.model.FileUser({ fileId: file._id, userId: userId, role: 'OWNER' }).save(function (err, fileUser) {
              if (err) {
                res.send(err, 500);
              } else {
                var event = new ApiExtensionEvent(req, {
                  fileId: file._id
                });
                      
                extensionEventEmitter.emit("createFile", event);
                api.sendResponse(res,
                  api.createResponseBuilder()
                    .setStatus(api.STATUS_OK)
                    .setResponse(event.getData())
                    .build()
                );
              }
            });
          }
        });
      }
    });
  };
  
  module.exports.getUserFiles = function(req, res) {
    var userId = req.params.userid;
    db.model.FileUser.find({ userId: userId }, 
      function (err, fileUsers) {
        if (err) {
          res.send(err, 500);
        } else {
          var roles = {};
          fileUsers.forEach(function (fileUser) {
            roles[fileUser.fileId] = fileUser.role;
          });

          db.model.File.find({ '_id': { $in: _.pluck(fileUsers, "fileId") } }, function (err, files) {
            var eventFiles = new Array();
            files.forEach(function (file) {
              eventFiles.push({
                id: file._id,
                name: file.name,
                revisionNumber: file.revisionNumber,
                role: roles[file._id]
              });
            });

            var event = new ApiExtensionEvent(req, {
              files: eventFiles
            });

            extensionEventEmitter.emit("listUserFiles", event);
            api.sendResponse(res,
              api.createResponseBuilder()
                .setStatus(api.STATUS_OK)
                .setResponse(event.getData())
                .build()
            ); 
          });
        }
      }
    );
  };
  
  module.exports.joinUserFile = function(req, res) {
    var userId = req.params.userid;
    var fileId = req.params.fileid;
    
    // Algorithms supported by the client. 
    var clientAlgorithms = req.query['algorithm'];
    if (!(clientAlgorithms instanceof Array)) {
      clientAlgorithms = Array(clientAlgorithms);
    }
    
    var algorithm = null;
    var serverAlgorithms = api.getAlgorithms();
    clientAlgorithms.forEach(function (clientAlgorithm) {
      if (serverAlgorithms.indexOf(clientAlgorithm) > -1) {
        algorithm = clientAlgorithm;
      }
    });
    
    // Version of protocol client is using 
    var protocolVersion = req.query['protocolVersion'];
    if (api.getProtocolVersion() != protocolVersion) {
      // TODO: Status code
    
      api.sendResponse(res,
        api.createResponseBuilder()
          .setStatus(api.STATUS_INTERNAL_SERVER_ERROR)
          .addMessage("Protocol version mismatch. Client is using " + protocolVersion + " and server " + api.getProtocolVersion())
          .build()
      );
    } else {
      if (algorithm == null) {
        // TODO: Status code
        api.sendResponse(res,
          api.createResponseBuilder()
            .setStatus(api.STATUS_INTERNAL_SERVER_ERROR)
            .addMessage("Server and client do not have a commonly supported algorithm. Server supported: " + serverAlgorithms + ", client supported: " + clientAlgorithms)
            .build()
        );
      } else {
        // TODO: Security
        // TODO: If user is not logged in: api.STATUS_UNAUTHORIZED
        // TODO: If user has no permission to file: api.STATUS_FORBIDDEN
        
        new db.model.Session({
          fileId: fileId,
          userId: userId,
          algorithm: algorithm
        }).save(function (err, session) {
          if (err) {
            res.send(err, 500);
          } else {
            var token = utils.uid(64);
            var clientId = (clientIdCounter++);
            
            var host = req.get('host');
            var hostPortIndex = host.indexOf(':');
            if (hostPortIndex != -1) {
              host = host.substring(0, hostPortIndex);
            }
            
            new db.model.WebSocketToken({
              token: token,
              clientId: clientId
            }).save(function (err2, webSocketToken) {
              if (err2) {
                res.send(err2, 500);
              } else {
                var path = '/1/users/' + userId + '/files/' + fileId + '/websocket/' + token;
                var eventData = {
                  sessionId: session._id,
                  extensions: api.getExtensions(),
                  fileId: fileId,
                  clientId: clientId
                };
                
                if (process.env.COOPS_UNSECURE_WEBSOCKET == "true") {
                  var unsecurePort = process.env.COOPS_UNSECURE_WEBSOCKET_PORT || process.env.COOPS_UNSECURE_PORT;
                  eventData.unsecureWebSocketUrl = 'ws://' + host + ':' + unsecurePort + path;
                }
  
                if (process.env.COOPS_SECURE_WEBSOCKET == "true") {
                  var securePort = process.env.COOPS_SECURE_WEBSOCKET_PORT || process.env.COOPS_SECURE_PORT;
                  eventData.secureWebSocketUrl = 'wss://' + host + ':' + securePort + path;
                }
                  
                var event = new ApiExtensionEvent(req, eventData);
                
                extensionEventEmitter.emit("fileJoin", event);
                api.sendResponse(res,
                  api.createResponseBuilder()
                    .setStatus(api.STATUS_OK)
                    .setResponse(event.getData())
                    .build()
                );
              }
            });
          }
        });
      }
    }
  };
  
  module.exports.getUserFile = function(req, res) {
    // TODO: Security
    var userId = req.params.userid;
    var fileId = req.params.fileid;
    // TODO: Better param name?
    var revision = req.query['revision'];
    
    if (revision === undefined) {
      db.model.File.findOne({ _id: fileId },function (err, file) {
        if (err) {
          res.send(err, 500);
        } else {
          db.model.FileContent.findOne({ fileId: fileId },function (err, fileContent) {
            if (err) {
              res.send(err, 500);
            } else {
              var event = new ApiExtensionEvent(req, {
                fileId: fileId,
                revisionNumber: file.revisionNumber,
                name: file.name,
                content: fileContent.content,
                contentType: fileContent.contentType
              });

              extensionEventEmitter.emit("getFile", event);
              api.sendResponse(res,
                api.createResponseBuilder()
                  .setStatus(api.STATUS_OK)
                  .setResponse(event.getData())
                  .build()
              );    
            }
          });
        }
      });
    } else {
      // TODO: Implement
      res.send("Revision is unimplemented", 500);
    }
  };
  
  module.exports.saveUserFile = function(req, res) {
    // save
    var userId = req.params.userid;
    var fileId = req.params.fileid;

    res.send("Save complete doc: " + userId + "," + fileId);
  };
  
  module.exports.patchUserFile = function(req, res) {
    // patch
    // json post: revision
    // json post: patch
    // json post: properties
    
    var userId = req.params.userid;
    var fileId = req.params.fileid;

    res.send("Patch doc: " + userId + "," + fileId);
  };
  
  module.exports.getFileUsers = function(req, res) {
    var fileId = req.params.fileid;
    
    db.model.FileUser.find({ fileId: fileId }, function (err, fileUsers) {
      if (err) {
        res.send(err, 500);
      } else {
        var data = new Array();
        fileUsers.forEach(function (fileUser) {
          data.push({
            userId: fileUser.userId,
            role: fileUser.role
          });
        });
      
        api.sendResponse(res,
          api.createResponseBuilder()
            .setStatus(api.STATUS_OK)
            .setResponse(data)
            .build()
        ); 
      }
    });
  };
  
  module.exports.updateFileUsers = function(req, res) {
    var fileId = req.params.fileid;
    var roles = ['OWNER', 'WRITER', 'READER', 'NONE'];
    
    var fileUsers = req.body;
    if (Array.isArray(fileUsers)) {
      var changedRoles = new Object();
    
      for (var i = 0, l = fileUsers.length; i < l; i++) {
        var fileUser = fileUsers[i];
        if ((fileUser.role == undefined) || (fileUser.userId == undefined)) {
          res.send("Invalid request", 500);
          return;
        }
        
        if (roles.indexOf(fileUser.role) == -1) {
          res.send("Invalid role specified", 500);
          return;
        }
        
        if (changedRoles[fileUser.userId]) {
          res.send("Two roles specified for user", 500);
          return;
        }
        
        changedRoles[fileUser.userId] = fileUser.role;
      }
      
      var userIds = _.keys(changedRoles);
      
      db.model.FileUser.find({ 'userId': { $in: userIds }, 'fileId': fileId }, function (err, fileUsers) {
        if (err) {
          res.send("Could not find existing users", 500);  
        } else {
      		var currentFiles = _.object(_.pluck(fileUsers, 'userId'), fileUsers);
      		var newFileUsers = new Array();
      		var deletedFileUsers = new Array();
      		var updatedFileUsers = new Array();

          for (var i = 0, l = userIds.length; i < l; i++) {
            var userId = userIds[i];
            if (!currentFiles[userId]) {
              // New file user
              if (changedRoles[userId] != 'OWNER') {
                var fileUser = new db.model.FileUser();
                fileUser.userId = userId;
                fileUser.fileId = fileId;
                fileUser.role = changedRoles[userId];
                newFileUsers.push(fileUser);
              } else {
                res.send("Cannot add new owner", 403);
                return;
              }
            } else if (currentFiles[userId].role != changedRoles[userId]) {
              // Changed file user
             	if (changedRoles[userId] == 'NONE') {
             	  if (currentFiles[userId].role != 'OWNER') {
                  // File user removed
             	    deletedFileUsers.push(currentFiles[userId]);
                } else {
                  res.send("Cannot remove file owner", 403);
                  return;
                }
             	} else {
             	  if (currentFiles[userId].role != 'OWNER') {
                  // File user role changed
                  var fileUser = currentFiles[userId];
             	    fileUser.role = changedRoles[userId];
             	    updatedFileUsers.push(fileUser);
             	  } else {
             	    res.send("Cannot change file owner role", 403);
                  return;
             	  }
             	}
            }
          }
	 	
      		// New and updated can be done in one save batch
      		var saves = new Array();
      		newFileUsers.concat(updatedFileUsers).forEach(function (fileUser) {
      		  saves.push(function (callback) {
      		    fileUser.save(callback);
      		  });
      		});
      		
      		async.parallel(saves, function (err, results) {
      		  if (err) {
              res.send("Could not persist some of the role changes", 500);
      		  } else {
      		    var deletes = new Array();
      		    deletedFileUsers.forEach(function (fileUser) {
      		      deletes.push(function (callback) {
      		        fileUser.remove(callback);
      		      });
      		    });
      		    
        		async.parallel(deletes, function (err, results) {
        		  if (err) {
                res.send("Could not persist some of the role changes", 500);
      		    } else {
      		      res.send("{}", 200);
      		    }
        		});
      		  }
      		});
        }
      });
    } else {
      res.send("Invalid request", 500);
    }
  };
  
}).call(this);