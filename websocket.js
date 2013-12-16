(function() {

  var WebSocketServer = require('ws').Server;
  var crypto = require('crypto');
  var _ = require('underscore');

  var db = require('./db');
  var diffAlgorithms = require('./diffalgorithms');

  var Client = function (sessionId, userId, fileId, revisionNumber, webSocket) {
    this._userId = userId;
    this._fileId = fileId;
    this._currentRevision = revisionNumber;
    this._webSocket = webSocket;
    this._sessionId = sessionId;
    
    var _this = this;
    this._webSocket.on('message', function (data, flags) {
      console.log("Received a websocket message");
      _this._onWebSocketMessage(data, flags);
    });
    
    this._webSocket.on('close', function() {
      _this.deinitialize();
    });
    
    // Poll for changes new revisions in the database
    var _this = this;
    this._changePoller = setInterval(function () {
      db.model.FileRevision.find({ 'revisionNumber' : { $gt: _this._currentRevision }, 'fileId': _this._fileId  }, function (err, fileRevisions) {
        fileRevisions.forEach(function (fileRevision) {
          _this._sendRevision(fileRevision);
          _this._currentRevision = fileRevision.revisionNumber; 
        });
      });
    }, 300);
  };
  
  Client.prototype = Object.create(null, {
    constructor: {
      value: Client,
      enumerable: false
    },
    deinitialize: {
      value: function () {
        clearInterval(this._changePoller);
      }
    },
    getWebSocket: {
      value: function () {
        return this._webSocket;
      }
    },
    getFileId: {
      value: function () {
        return this._fileId;
      }
    },
    _sendRevision: {
      value: function(fileRevision) {
        this._webSocket.send(JSON.stringify({
          type: 'patch',
          userId: fileRevision.userId,
          sessionId: fileRevision.sessionId,
          patch: fileRevision.patch,
          revisionNumber: fileRevision.revisionNumber,
          checksum: fileRevision.checksum
        }));
      }
    },
    
    _onWebSocketMessage: {
      value: function(data, flags) {
        // flags.binary will be set if a binary data is received
        // flags.masked will be set if the data was masked
        var json = JSON.parse(data);
        var userId = this._userId;
        
        switch (json.type) {
          case 'patch':
            this._handlePatchMessage(json.patch, json.revisionNumber, userId);
          break;
          case 'revert':
            this._handleRevertMessage();
          break;
          default:
            console.log("Received an unknown websocket message");
          break;
        }
      }
    },
    
    _handlePatchMessage: {
      value: function (patch, patchRevision, userId) {
        console.log("Received patch from " + userId + " for revision " + patchRevision);
        
        var _this = this;
        db.model.File.findOne({ '_id': this._fileId }, function (err, file) {
          if (err) {
            console.err("Error occurred while finding a file" + err);
            _this._rejectPatch(patchRevision, "Could not find file: " + err);
          } else {
            if (file.revisionNumber == patchRevision) {
              console.log("Patch ok, patching file");
              // Patch is to this revision so we can accept it
              _this._patchFile(file, userId, patchRevision, patch);          
            } else {
              console.log("Out of sync, rejecting patch " + patchRevision + ' != ' + file.revisionNumber);
              // Patch is not to this revision, so we reject it
              _this._rejectPatch(patchRevision, "Out of sync");
            }
          }
        });
      }
    },
    
    _handleRevertMessage: {
      value: function () {
        console.log("Received revert request");
        var _this = this;
        db.model.File.findOne({ '_id': this._fileId }, function (err1, file) {
          if (err1) {
            console.err(err1);
          } else {
            db.model.FileContent.findOne({ 'fileId': _this._fileId }, function (err2, fileContent) {
              if (err2) {
                console.err(err2);
              } else {
                _this._webSocket.send(JSON.stringify({
                  type: 'revert',
                  revisionNumber: file.revisionNumber,
                  content: fileContent.content,
                  contentType: fileContent.contentType
                }));
              }
            });
          }
        });
      }
    },

    _rejectPatch: {
      value: function(revisionNumber, reason) {
        this._webSocket.send(JSON.stringify({
          type: 'patchRejected',
          revisionNumber: revisionNumber,
          reason: reason
        }));
      }
    },
    
    _createRevision: {
      value: function (file, userId, revisionNumber, patch, checksum, created, callback) {
        // New revision
        new db.model.FileRevision({ 
          fileId: file._id, 
          userId: userId,
          revisionNumber: revisionNumber, 
          patch: patch, 
          checksum: checksum,
          created: created,
          sessionId: this._sessionId
        }).save(function (err, fileRevision) {
          callback(err, fileRevision);
        });
      }
    },
    
    _patchFile: {
      value: function (file, userId, patchRevision, patch) {
        var _this = this;
        
        db.model.FileContent.findOne({ 'fileId': file._id}, function (err1, fileContent) {
          if (err1) {
            _this._rejectPatch(patchRevision, "Internal Server Error:" + err1);
          } else {
            // Unhardcode algorithm
            var patchResult = diffAlgorithms.getAlgorithm('dmp').patch(patch, fileContent.content);
            if (patchResult.applied) {
              var checksum = crypto.createHash('md5').update(patchResult.patchedText).digest("hex");
              var patchCreated = new Date();
              // Patch applied succesfully
              var patchedRevision = patchRevision + 1;
              _this._createRevision(file, userId, patchedRevision, patch, checksum, patchCreated, function (err2, fileRevision) {
                if (err2) {
                  _this._rejectPatch(patchRevision, "Internal Server Error:" + err2);
                } else {
                  fileContent.content = patchResult.patchedText;
                  fileContent.save(function (err3, fileContent) {
                    if (err3) {
                      fileRevision.remove(function () {
                        _this._rejectPatch(patchRevision, "Internal Server Error:" + err3);
                      });
                    } else {
                      file.modified = patchCreated;
                      file.revisionNumber = patchedRevision;
                      
                      file.save(function (err4, updatedFile) {
                        if (err4) {
                          fileRevision.remove(function () {
                            _this._rejectPatch(patchRevision, "Internal Server Error:" + err3);
                          });
                        }
                      })
                    }
                  });
                }
              });
            } else {
              // Patching failed, so we reject the patch
              _this._rejectPatch(patchRevision, "Failed to apply patch");
            }
          }
        });
      }
    }
  });
  
  function onWebSocketServerConnection(webSocket) {
    var url = webSocket.upgradeReq.url;
    var slices = url.split('/');
    var userId = slices[3];
    var fileId = slices[5];
    var token = slices[7];
  
    db.model.WebSocketToken.findOne({ 'token': token }, function (err1, webSocketToken) {
      if (err1) {
        webSocket.close(1011, err1);
      } else if (webSocketToken) {
        var sessionId = webSocketToken.sessionId;
        webSocketToken.remove(function (err2) {
          if (err2) {
            webSocket.close(1011, err2);
          } else {
            db.model.File.findOne({ '_id': fileId }, function (err3, file) {
              if (err3) {
                webSocket.close(1011, err3);
              } else {
                var client = new Client(sessionId, userId, fileId, file.revisionNumber, webSocket);
                console.log("Client connected.");
              }
            });           
          }
        });
      } else {
        webSocket.close(1000, "Permission Denied");
      }
    });
  };
   
  module.exports = {
    initialize: function(unsecureServer, secureServer) {
      if (unsecureServer) {
        var unsecureWebSocketServer = new WebSocketServer({
           server: unsecureServer
        });
        
        unsecureWebSocketServer.on('connection', onWebSocketServerConnection);
        
        console.log("Unsecure WebSocketServer listening");
      }
      
      if (secureServer) {
        var secureWebSocketServer = new WebSocketServer({
           server: secureServer
        });
        
        secureWebSocketServer.on('connection', onWebSocketServerConnection);
        
        console.log("Secure WebSocketServer listening");
      }
    }
  };

}).call(this);