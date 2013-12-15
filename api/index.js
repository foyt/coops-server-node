(function() {
  
  // Imports
  
  var diffAlgorithms = require('../diffalgorithms');
  var settings = require('../settings');
  var async = require('async');
  var db = require("../db");
  var crypto = require('crypto');
  var _ = require('underscore');
  
  // Settings
  
  var VERSION = '1.0.0draft2';
  var ALGORITHMS = ['dmp'];
  var EXTENSIONS = ['websockets', 'x-http-method-override'];
  
  var clientIdCounter = new Date().getTime();
    
  // Exports
  
  /**
   * Creates new user.
   * 
   * Expects following JSON object in request body (User without id):
   * 
   * {
   *   "properties": {
   *     "key": "value"
   *   }
   * }
   * 
   * Returns following JSON string (User):
   * 
   * {
   *   "id": "id of created user",
   *   "properties": {
   *     "key": "value"
   *   }
   * }
   */
  module.exports.createUser = function (req, res) {
    var client = req.user;
    
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
      message = "Cannot specify an id when creating new user";
      status = 400;
    }
    
    if (valid) { 
      var user = new db.model.User();
      user.save(function (err, newUser) {
        if (err) {
          res.send(err, 500);
        } else {
          var propertySaves = new Array();
          
          var expireTime = 1000 * 60 * 60 * 24;
          var accessToken = new db.model.AccessToken();
          accessToken.token = crypto.randomBytes(64).toString('hex');
          accessToken.refreshToken = crypto.randomBytes(64).toString('hex');
          accessToken.userId = newUser._id;
          accessToken.clientId = client._id;
          accessToken.expires = expireTime + new Date().getTime();
          
          if (reqBody.properties) {
            _.keys(reqBody.properties).forEach(function (key) {
              var value = reqBody.properties[key];
              var userProperty = new db.model.UserProperty();
              userProperty.key = key;
              userProperty.value = value;
              userProperty.userId = newUser._id;
              propertySaves.push(function (callback) {
                userProperty.save(callback);
              });
            });
          }

          async.parallel(propertySaves, function (err, savedPropertyResults) {
            if (err) {
              res.send(err, 500);
            } else {
              accessToken.save(function (err, newAccessToken) {
                var responseProperties = new Object();
                savedPropertyResults.forEach(function (savedPropertyResult) {
                  var savedProperty = savedPropertyResult[0];
                  responseProperties[savedProperty.key] = savedProperty.value;
                });

                var response = {
                  "id": newAccessToken.userId,
                  "properties": responseProperties,
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
            };
          });
        }
      });   
    } else {
      res.send(message, status);
    }
  };

  /**
   * Lists users. 
   * 
   * Returns array of users (array of CompactUser):
   * 
   *  [
   *    {
   *     "id": "id of user"
   *    }, 
   *    ...
   *  ]
   */  
  module.exports.getUsers = function(req, res) {
    db.model.User.find(function (err, users) {
      if (err) {
        res.send(err, 500);
      } else {
        var response = new Array();
        users.forEach(function (user) {
          response.push({
            id: user._id
          });
        });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(response));
      }
    });
  };
  
  /**
   * Returns a user.
   * 
   * Returns following JSON string (single User entity):
   * 
   * {
   *   "id": "id of user",
   *   "properties": {
   *     "key": "value"
   *   }
   * }
   */
  module.exports.getUser = function(req, res) {
    var userId = req.params.userid;
    
    db.model.User.findOne({ _id: userId }, function (err1, user) {
      if (err1) {
        res.send(err1, 500);
      } else {
        db.model.UserProperty.find( { userId: user._id }, function (err2, userProperties) {
          if (err2) {
            res.send(err2, 500);
          } else {
            var properties = _.object(_.pluck(userProperties, 'key'), _.pluck(userProperties, 'value'));

            var response = {
              id: user._id,
              properties: properties
            };
            
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.send(JSON.stringify(response));
          }
        });
      }
    });
  };
  
  /**
   * Creates new file.
   * 
   * Expects following JSON object in request body (File without id and modified):
   * 
   * {
   *   "revisionNumber": 0,
   *   "name": "Name of the file",
   *   "role": "OWNER",
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
   *   "contentType": "mime/type;editor=preferredEditor",
   *   "modified": "Last modification time of file"
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
      message = "Cannot specify an id when creating new file";
      status = 400;
    }
    
    if (valid && (reqBody.revisionNumber !== 0)) {
      valid = false;
      message = "revisionNumber must be 0 when creating new file";
      status = 400;
    }
    
    if (valid && (reqBody.role !== 'OWNER')) {
      valid = false;
      message = "Role must be OWNER when creating new file";
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

    if (valid) {
      var userId = req.params.userid;
      var name = reqBody.name;
      // If initial content is undefined or null we change it to blank
      var content = (reqBody.content === undefined)||(reqBody.content === null) ? '' : reqBody.content;
      var contentType = reqBody.contentType;
      var now = new Date();
      
      new db.model.File({ name: name, revisionNumber: 0, modified: now }).save(function (err1, file) {
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
  
  /**
   * Lists user files. 
   * 
   * Returns array of user files (array of CompactFile):
   * 
   *  [
   *    {
   *     "id": Id of the file,
   *     "name": "Name of the file",
   *     "revisionNumber": Current file revision number,
   *     "role": "User's role in file" one of OWNER,WRITER or READER
   *    }, 
   *    ...
   *  ]
   */
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

          var response = new Array();

          db.model.File.find({ '_id': { $in: _.pluck(fileUsers, "fileId") } }, function (err, files) {
            files.forEach(function (file) {
              response.push({
                id: file._id,
                name: file.name,
                revisionNumber: file.revisionNumber,
                role: roles[file._id]
              });
            });

            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.send(JSON.stringify(response));
          });
        }
      }
    );
  };
  
  /**
   * Joins collaboration session
   * 
   * Expects following query parametrs:
   * 
   *   algorithm=Used difference algorithm
   *   protocolVersion=Used protocol version
   *   
   * Returns following JSON string (FileJoin):
   * 
   * {
   *   "extensions": ["array", "of", "supported", "extensions"],
   *   "fileId": "Id of the file",
   *   "revisionNumber": Current revision number of the file,
   *   "content": "contents of the file or blank if not specified",
   *   "contentType": "mime/type;editor=preferredEditor",
   *   "clientId": "Unique id of WebSocket client",
   *   "unsecureWebSocketUrl": "Address for joining WebSocket session (unsecure)",
   *   "secureWebSocketUrl": "Address for joining WebSocket session (secure)"
   * }
   */
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
                    
                    if (settings.unsecureWebSocket) {
                      var unsecurePort = settings.unsecureWebSocketPort || settings.unsecurePort;
                      response.unsecureWebSocketUrl = 'ws://' + host + ':' + unsecurePort + path;
                    }
      
                    if (settings.secureWebSocket) {
                      var securePort = settings.secureWebSocketPort || settings.securePort;
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

  /**
   * Returns a file
   * 
   * Following query parameters are supported:
   * 
   *   revisionNumber=Return specific revision instead of current revision
   * 
   * Returns following JSON string (File):
   * 
   * {
   *   "id": "Id of the file",
   *   "name": "Name of the file",
   *   "modified": "Last modification time of file/file revision ",
   *   "revisionNumber": Revision number of returned file,
   *   "content": "contents of the file or blank if not specified",
   *   "contentType": "mime/type;editor=preferredEditor",
   *   "role": "User's role in file" one of OWNER,WRITER or READER
   * }
   */
  module.exports.getUserFile = function(req, res) {
    var userId = req.params.userid;
    var fileId = req.params.fileid;
    var revision = req.query['revisionNumber'];
    
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
                    modified: file.modified,
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
      db.model.File.findOne({ _id: fileId },function (err1, file) {
        // TODO: Unhardcode algorithm
        var algorithm = diffAlgorithms.getAlgorithm('dmp');
        db.model.FileContent.findOne({ fileId: fileId },function (err2, fileContent) {
          if (err2) {
            res.send(err2, 500);
          } else {
            var currentContent = fileContent.content;
            db.model.FileUser.findOne({ fileId: fileId, userId: userId }, function (err3, fileUser) {
              if (err3) {
                res.send(err3, 500);
              } else {
                db.model.FileRevision.find({ fileId: fileId, revisionNumber: { $gte: revision } }, function (err4, fileRevisions) {
                  if (err4) {
                    res.send(err4, 500);
                  } else {
                    var resultRevision = null;
                    var resultCreated = null;
                    
                    fileRevisions.reverse().forEach(function (fileRevision) {
                      var result = algorithm.unpatch(fileRevision.patch, currentContent);
                      if (result.applied) {
                        currentContent = result.patchedText;
                        resultRevision = fileRevision.revisionNumber;
                        resultCreated = fileRevision.created;
                      } else {
                        res.send("Could not apply reverse patch", 500); 
                      }
                    }); 
      
                    var response = {
                      id: fileId,
                      revisionNumber: resultRevision||0,
                      modified: resultCreated,
                      name: file.name,
                      role: fileUser.role,
                      content: currentContent,
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
      });
    }
  };
  
  /**
   * Saves a file
   * 
   * Expects following JSON object in request body (File):
   * 
   * {
   *   "id": id of the file,
   *   "name": "Name of the file",
   *   "content": "contents of the file",
   *   "contentType": "mime/type;editor=preferredEditor",
   *   "role": one of 'OWNER', 'WRITER' or 'READER',
   *   "revisionNumber": expected revision number
   * }
   * 
   * Returns 204 (No Content) if update is a success
   */
  module.exports.saveUserFile = function(req, res) {
    var fileId = req.params.fileid;
    var userId = req.params.userid;
    var user = req.user;
    var reqBody = req.body;
    var valid = true;
    var message = null;
    var status = 200;
    
    if (!reqBody) {
      valid = false;
      message = "Invalid request";
      status = 400;
    } 
    
    if (valid && (reqBody.id !== fileId)) {
      valid = false;
      message = "Cannot replace file with another";
      status = 400;
    }
    
    if (valid && (user.id != userId)) {
      valid = false;
      message = "Cannot update file of another user";
      status = 400;
    }

    if (valid) {
      db.model.File.findOne({ _id: fileId },function (err1, file) {
        if (err1) {
          res.send(err1, 500);
        } else {
          if ((reqBody.revisionNumber - 1) !== file.revisionNumber) {
            valid = false;
            message = "revisionNumber must be exactly one more than old file when saving";
            status = 400;
          }
          
          if (valid && ((file.role === 'OWNER') && (reqBody.role !== 'OWNER'))) {
            valid = false;
            message = "Cannot change role of the file owner";
            status = 400;
          }
          
          if (valid) {
            var now = new Date();
            
            file.revisionNumber = reqBody.revisionNumber;
            file.name = reqBody.name;
            file.modified = now;
            
            db.model.FileContent.findOne({ fileId: file._id }, function (err2, fileContent) {
              if (err2) {
                res.send(err2, 500);
              } else {
                var saves = new Array();
                
                if ((fileContent.content !== reqBody.content)||(fileContent.contentType !== reqBody.contentType)) {
                  if (fileContent.content !== reqBody.content) {
                    // TODO: Unhardcode algorithm
                    var algorithm = diffAlgorithms.getAlgorithm('dmp');
                    var patch = algorithm.makePatch(fileContent.content, reqBody.content);
                    var checksum = crypto.createHash('md5').update(reqBody.content).digest("hex");
                    
                    var fileRevision = new db.model.FileRevision({ 
                      fileId: file._id, 
                      userId: userId,
                      revisionNumber: reqBody.revisionNumber, 
                      patch: patch, 
                      checksum: checksum,
                      created: now,
                      clientId: -1
                    });
                    
                    saves.push(function (callback) {
                      fileRevision.save(callback);
                    });
                  }

                  fileContent.content = reqBody.content;
                  fileContent.contentType = reqBody.contentType;
                  
                  saves.push(function (callback) {
                    fileContent.save(callback);
                  });
                }

                saves.push(function (callback) {
                  file.save(callback);
                });
                
                async.parallel(saves, function (err3, saveResults) {
                  // TODO: Rollback...
                  if (err3) {
                    res.send(err3, 500);
                  } else {
                    res.send(204);
                  }
                });
              }
            });

          } else {
            res.send(message, status);
          }
        }
      });
    } else {
      res.send(message, status);
    }
  };
  
  module.exports.patchUserFile = function(req, res) {
    var userId = req.params.userid;
    var fileId = req.params.fileid;
    var user = req.user;
    var reqBody = req.body;
    var valid = true;
    var message = null;
    var status = 200;
    
    if (!reqBody) {
      valid = false;
      message = "Invalid request";
      status = 400;
    } 
    
    if (valid && (user.id != userId)) {
      valid = false;
      message = "Cannot update file of another user";
      status = 400;
    }
    
    if (reqBody.patch) {
      if (valid && (!reqBody.algorithm)) {
        valid = false;
        message = "Algorithm is required when applying patch";
        status = 400;
      }
      
      if (!diffAlgorithms.isAlgorithmAvailable(reqBody.algorithm)) {
        valid = false;
        message = "Algorithm is not supported by this server";
        status = 400;
      }
    }

    if (valid) {
      db.model.File.findOne({ _id: fileId },function (err1, file) {
        if (err1) {
          res.send(err1, 500);
        } else {
          if ((reqBody.revisionNumber - 1) !== file.revisionNumber) {
            valid = false;
            message = "revisionNumber must be exactly one more than old file when patching";
            status = 400;
          }
          
          if (valid && ((file.role === 'OWNER') && (reqBody.role !== 'OWNER'))) {
            valid = false;
            message = "Cannot change role of the file owner";
            status = 400;
          }
          
          if (valid) {
            var now = new Date();
            
            file.revisionNumber = reqBody.revisionNumber;
            file.modified = now;

            if (reqBody.name) {
              file.name = reqBody.name;
            }
            
            db.model.FileContent.findOne({ fileId: file._id }, function (err2, fileContent) {
              var content = fileContent.content;
              
              if (reqBody.patch) {
                var patchResult = diffAlgorithms.getAlgorithm(reqBody.algorithm).patch(reqBody.patch, content);
                if (patchResult.applied) {
                  content = patchResult.patchedText;
                } else {
                  valid = false;
                  message = "Could not apply the patch";
                  status = 500;
                }
              }

              if (valid) {
                var propertySaves = new Array();
                
                var fileRevision = new db.model.FileRevision({ 
                  fileId: file._id, 
                  userId: userId,
                  revisionNumber: reqBody.revisionNumber, 
                  patch: reqBody.patch, 
                  checksum: crypto.createHash('md5').update(content).digest("hex"),
                  created: now,
                  clientId: -1
                });
                
                fileRevision.save(function (err3, savedRevision) {
                  // TODO: Rollback...
                  if (err3) {
                    res.send(err3, 500);
                  } else {
                    var propertyKeys = _.keys(reqBody.properties||{});
                    
                    db.model.FileProperty.find({ 'key': { $in: propertyKeys }, 'fileId': file._id }, function (err4, fileProperties) {
                      if (err4) {
                        res.send(err4, 500);
                      } else {
                        var existingFileProperties = _.object(_.pluck(fileProperties, 'key'), fileProperties);
                        propertyKeys.forEach(function (key) {
                          var value = reqBody.properties[key];

                          // File Property
                          var fileProperty = existingFileProperties[key];
                          if (fileProperty) {
                            // Property already exists
                            if (fileProperty.value != value) {
                              fileProperty.value = value;
                              propertySaves.push(function (callback) {
                                fileProperty.save(callback);
                              });
                            }
                          } else {
                            // Property does not exist
                            
                            fileProperty = new db.model.FileProperty();
                            fileProperty.key = key;
                            fileProperty.value = value;
                            fileProperty.fileId = file._id;
                            
                            propertySaves.push(function (callback) {
                              fileProperty.save(callback);
                            });
                          }
                          
                          // Revision Property
                          var revisionProperty = new db.model.FileRevisionProperty();
                          revisionProperty.key = key;
                          revisionProperty.value = value;
                          revisionProperty.fileRevisionId = savedRevision._id;
                          propertySaves.push(function (callback) {
                            revisionProperty.save(callback);
                          });
                        });

                        fileContent.save(function (err4, savedContent) {
                          if (err4) {
                            res.send(err4, 500);
                          } else {
                            file.save(function (err5, savedFile) {
                              if (err5) {
                                res.send(err5, 500);
                              } else {
                                async.parallel(propertySaves, function (err6, saveResults) {
                                  if (err6) {
                                    res.send(err6, 500);
                                  } else {
                                    res.send(204);
                                  }
                                });
                              };
                            });
                          }
                        });
                      }
                    });
                  }
                });
              } else {
                res.send(message, status);
              }
            });
          } else {
            res.send(message, status);
          }
        }
      });
    } else {
      res.send(message, status);
    }
  };
  
  /**
   * Returns list of file users
   * 
   *  [
   *    {
   *      "userId": "Id of user that made the change",
   *      "role": one of 'OWNER', 'WRITER' or 'READER'
   *    }, 
   *    ...
   *  ]
   */
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
  
  /**
   * Updates file users
   * 
   * Expects array following JSON object in request body (FileUser):
   * 
   * [
   *   {
   *     "userId": "Id of user that made the change",
   *     "role": either 'WRITER' or 'READER'
   *   } 
   * ]
   * 
   * Returns 204 (No Content) if update is a success
   */
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
      		      res.send(204);
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

  /**
   * Returns file revisions
   * 
   * Returns array of file revisions (single FileRevision entity):
   * 
   *  [
   *    {
   *      "revisionNumber": Number of revision,
   *      "userId": "Id of user that made the change",
   *      "checksum": "Checksum of the revision"
   *    }, 
   *    ...
   *  ]
   */
  module.exports.getFileRevisions = function(req, res) {
    var fileId = req.params.fileid;

    db.model.FileRevision.find({
      fileId: fileId
    }, function (err, fileRevisions) {
      if (err) {
        res.send("Could not list file revisions", 500);  
      } else {
        var response = new Array();
        
        fileRevisions.forEach(function (fileRevision) {
          response.push({
            revisionNumber: fileRevision.revisionNumber,
            userId: fileRevision.userId,
            checksum: fileRevision.checksum,
            created: fileRevision.created
          });
        });
        
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(response));
      };
    });
  }
  
}).call(this);