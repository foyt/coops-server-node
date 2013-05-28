(function() {

  var crc = require('crc');
  var WebSocketServer = require('ws').Server;
  var events = require('events');
  var db = require('./db');
  var diffAlgorithms = require('./diffalgorithms');
  var _ = require('underscore');

  var Client = function (clientId, userId, fileId, revisionNumber, webSocket) {
    events.EventEmitter.call(this);

    this._userId = userId;
    this._fileId = fileId;
    this._currentRevision = revisionNumber;
    this._webSocket = webSocket;
    this._clientId = clientId;
    
    var _this = this;
    this._webSocket.on('message', function (data, flags) {
      _this._onWebSocketMessage(data, flags);
    });
    
    this.on("receivePatch", function (event) {
      _this._onReceivePatch(event);
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
    
    // Listen for local changes
    db.schema.FileRevision.post('save', function (fileRevision) {
      if (fileRevision.revisionNumber > _this._currentRevision) {
        _this._sendRevision(fileRevision);
        _this._currentRevision = fileRevision.revisionNumber; 
      }
    })
  };
  
  Client.super_ = events.EventEmitter;
  
  Client.prototype = Object.create(events.EventEmitter.prototype, {
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
          clientId: fileRevision.clientId,
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
            this.emit("receivePatch", {
              patch: json.patch,
              revisionNumber: json.revisionNumber,
              userId: userId
            });
          break;
        }
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
          clientId: this._clientId
        }).save(function (err, fileRevision) {
          if (err) {
            callback(err, null);
          } else {
            // Update document revision
            file.revisionNumber = revisionNumber;
            file.save(function (err, file) {
              callback(err, fileRevision);
            });
          }
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
            var patchResult = diffAlgorithms.getAlgorithm('dmp').patch(patch, fileContent.content);
            if (patchResult.applied) {
              var checksum = crc.crc32(patchResult.patchedText);
              var patchCreated = new Date();
              // Patch applied succesfully
              _this._createRevision(file, userId, patchRevision + 1, patch, checksum, patchCreated, function (err2, fileRevision) {
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
    },
    
    _onReceivePatch: {
      value: function (event) {
  	    var patch = event.patch;
  	    var patchRevision = event.revisionNumber;
  	    var userId = event.userId;
  	    var _this = this;
  	    db.model.File.findOne({ '_id': this._fileId }, function (err, file) {
  	      if (err) {
  	        _this._rejectPatch(patchRevision, "Could not find file: " + err);
  	      } else {
  	        if (file.revisionNumber == patchRevision) {
  	          // Patch is to this revision so we can accept it
  	          _this._patchFile(file, userId, patchRevision, patch);          
  	        } else {
  	          // Patch is not to this revision, so we reject it
  	          _this._rejectPatch(patchRevision, "Out of sync");
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
        var clientId = webSocketToken.clientId;
        webSocketToken.remove(function (err2) {
          if (err2) {
            webSocket.close(1011, err2);
          } else {
            db.model.File.findOne({ '_id': fileId }, function (err3, file) {
              if (err3) {
                webSocket.close(1011, err3);
              } else {
                var client = new Client(clientId, userId, fileId, file.revisionNumber, webSocket);
                webSocket.on('close', function() {
                  // TODO: Socket close
                });
                
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