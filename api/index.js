(function() {
  var async = require('async');
  var db = require("../db");
  var crypto = require('crypto');
  var _ = require('underscore');
  
  var VERSION = '1.0.0draft2';
  var ALGORITHMS = ['dmp'];
  var EXTENSIONS = ['websockets', 'x-http-method-override'];
  
  var clientIdCounter = new Date().getTime();
    
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
        accessToken.token = crypto.randomBytes(64).toString('hex');
        accessToken.refreshToken = crypto.randomBytes(64).toString('hex');
        accessToken.userId = newUser._id;
        accessToken.clientId = client._id;
        accessToken.expires = expireTime + new Date().getTime();
        
        accessToken.save(function (err, newAccessToken) {
          var response = {
            "user_id": newAccessToken.userId,
            "access_token": {
              "access_token": newAccessToken.token,
              "token_type":"Bearer",
              "expires_in":  newAccessToken.expires - new Date().getTime(),
              "refresh_token": newAccessToken.refreshToken
            } 
          };

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.send(JSON.stringify(response));
        });
      }
    });   
  };

  module.exports.getUsers = function(req, res) {
    db.model.User.find(function (err, users) {
      if (err) {
        res.send(err, 500);
      } else {
        var response = {
          userIds: _.pluck(users, "_id")
        };

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(response));
      }
    });
  };
  
  module.exports.getUser = function(req, res) {
    var userId = req.params.userid;
    
    db.model.User.findOne({ _id: userId }, function (err, user) {
      if (err) {
        res.send(err, 500);
      } else {
        var response = {
          userId: user._id,
          name: user.name
        };
        
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(response));
      }
    });
  };
  
  /**
   * Creates new file.
   * 
   * Expects following JSON object in request body:
   * 
   * {
   *   "name": "Name of the file",
   *   "content": "contents of the file (optional)",
   *   "contentType": "mime/type;editor=preferredEditor"
   * }
   * 
   * Returns following JSON string:
   * 
   * {
   *   "id": "id of created file",
   *   "revisionNumber": 0,
   *   "name": "Name of the file",
   *   "role": "OWNER",
   *   "content": "contents of the file or blank if not specified",
   *   "contentType": "mime/type;editor=preferredEditor"
   * }
   */
  module.exports.createUserFile = function(req, res) {
    var reqBody = req.body;
    var valid = true;
    var message = null;
    var status = 200;
    
    if (!reqBody) {
      valid = false;
      message = "Invalid request";
      status = 400;
    } 
    
    if (valid && (reqBody.id !== undefined)) {
      valid = false;
      message = "Cannot specify a id when creating a new file";
      status = 400;
    }
    
    if (valid && (reqBody.revisionNumber !== undefined)) {
      valid = false;
      message = "Cannot specify a revisionNumber when creating a new file";
      status = 400;
    }
    
    if (valid && (reqBody.role !== undefined)) {
      valid = false;
      message = "Cannot specify a role when creating a new file";
      status = 400;
    }
    
    if (valid && (!reqBody.name)) {
      valid = false;
      message = "Name is required when creating a new file";
      status = 400;
    }
    
    if (valid && (!reqBody.contentType)) {
      valid = false;
      message = "contentType is required when creating a new file";
      status = 400;
    } 

    if  (valid) {
      var userId = req.params.userid;
      var name = reqBody.name;
      // If initial content is undefined or null we change it to blank
      var content = (reqBody.content === undefined)||(reqBody.content === null) ? '' : reqBody.content;
      var contentType = reqBody.contentType;
      
      new db.model.File({ name: name, revisionNumber: 0 }).save(function (err1, file) {
        if (err1) {
          res.send(err1, 500);
        } else {
          new db.model.FileContent({ fileId: file._id, content: content, contentType: contentType }).save(function (err2, fileContent) {
            if (err2) {
              res.send(err2, 500);
            } else {
              new db.model.FileUser({ fileId: file._id, userId: userId, role: 'OWNER' }).save(function (err3, fileUser) {
                if (err3) {
                  res.send(err3, 500);
                } else {
                  var response = {
                    id: file._id,
                    revisionNumber: file.revisionNumber,
                    name: file.name,
                    role: fileUser.role,
                    content: fileContent.content,
                    contentType: fileContent.contentType
                  };
  
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.send(JSON.stringify(response));
                }
              });
            }
          });
        }
      });
    } else {
      res.send(message, status);
    }
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

            var response = {
              files: eventFiles
            };
            
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.send(JSON.stringify(response));
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
    
    clientAlgorithms.forEach(function (clientAlgorithm) {
      if (ALGORITHMS.indexOf(clientAlgorithm) > -1) {
        algorithm = clientAlgorithm;
      }
    });

    // Version of protocol client is using 
    var protocolVersion = req.query['protocolVersion'];
    if (VERSION != protocolVersion) {
      res.send(501, "Protocol version mismatch. Client is using " + protocolVersion + " and server " + VERSION);
    } else {
      if (algorithm == null) {
        res.send(501, "Server and client do not have a commonly supported algorithm. Server supported: " + serverAlgorithms + ", client supported: " + clientAlgorithms)
      } else {
        db.model.File.findOne({ _id: fileId },function (err1, file) {
          if (err1) {
            res.send(err1, 500);
          } else {
            db.model.FileContent.findOne({ fileId: file._id },function (err2, fileContent) {
              if (err2) {
                res.send(err2, 500);
              } else {
                var token = crypto.randomBytes(64).toString('hex');
                var clientId = clientIdCounter++;
                
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
                    var response = {
                      extensions: EXTENSIONS,
                      fileId: file._id,
                      revisionNumber: file.revisionNumber,
                      content: fileContent.content,
                      contentType: fileContent.contentType,
                      clientId: webSocketToken.clientId
                    };
                    
                    if (process.env.COOPS_UNSECURE_WEBSOCKET == "true") {
                      var unsecurePort = process.env.COOPS_UNSECURE_WEBSOCKET_PORT || process.env.COOPS_UNSECURE_PORT;
                      response.unsecureWebSocketUrl = 'ws://' + host + ':' + unsecurePort + path;
                    }
      
                    if (process.env.COOPS_SECURE_WEBSOCKET == "true") {
                      var securePort = process.env.COOPS_SECURE_WEBSOCKET_PORT || process.env.COOPS_SECURE_PORT;
                      response.secureWebSocketUrl = 'wss://' + host + ':' + securePort + path;
                    }
    
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.send(JSON.stringify(response));
                  }
                });
              }
            });
          }
        });
      }
    }
  };
  
  module.exports.getUserFile = function(req, res) {
    var userId = req.params.userid;
    var fileId = req.params.fileid;
    // TODO: Better param name?
    var revision = req.query['revision'];
    
    if (revision === undefined) {
      db.model.File.findOne({ _id: fileId },function (err1, file) {
        if (err1) {
          res.send(err1, 500);
        } else {
          db.model.FileContent.findOne({ fileId: fileId },function (err2, fileContent) {
            if (err2) {
              res.send(err2, 500);
            } else {
              db.model.FileUser.findOne({ fileId: fileId, userId: userId }, function (err3, fileUser) {
                if (err3) {
                  res.send(err3, 500);
                } else {
                  var response = {
                    id: fileId,
                    revisionNumber: file.revisionNumber,
                    name: file.name,
                    role: fileUser.role,
                    content: fileContent.content,
                    contentType: fileContent.contentType
                  };
                  
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.send(JSON.stringify(response)); 
                }
              });
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
        var response = new Array();
        fileUsers.forEach(function (fileUser) {
          response.push({
            userId: fileUser.userId,
            role: fileUser.role
          });
        });
        
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(response));
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
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
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