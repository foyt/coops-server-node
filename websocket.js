(function() {

  var diffMatchPatchMod = require('googlediff');
  var diffMatchPatch = new diffMatchPatchMod();
  var crc = require('crc');
  var WebSocketServer = require('ws').Server;
  var events = require('events');
  var db = require('./db');
  
  var connectedClients = new Object();
  
  function getConnectedClients(fileId) {
    return connectedClients[fileId];
  }
  
  function removeConnectedClient(client) {
    var clients = connectedClients[client.getFileId()];

    for (var i = clients.length - 1; i >= 0; i--) {
      if (clients[i] === client) {
        clients.splice(i, 1);
        break;
      }
    }
    
    client.deinitialize(); 
  }
   
  function addConnectedClient(client) {
    var clients = connectedClients[client.getFileId()];
    if (clients == null) {
      connectedClients[client.getFileId()] = clients = new Array();
    }
    clients.push(client);
  }
    
  var Client = function (clientId, fileId, webSocket) {
    events.EventEmitter.call(this);

    this._fileId = fileId;
    this._webSocket = webSocket;
    this._clientId = clientId;
    
    var _this = this;
    this._webSocket.on('message', function (data, flags) {
      _this._onWebSocketMessage(data, flags);
    });
    
    this.on("receivePatch", function (event) {
      _this._onReceivePatch(event);
    });
  };
  
  Client.super_ = events.EventEmitter;
  
  Client.prototype = Object.create(events.EventEmitter.prototype, {
    constructor: {
      value: Client,
      enumerable: false
    },
    deinitialize: {
      value: function () {
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
    sendRevision: {
      value: function(clientId, fileRevision) {
        this._webSocket.send(JSON.stringify({
          type: 'patch',
          userId: fileRevision.userId,
          clientId: clientId,
          patch: fileRevision.patch,
          revisionNumber: fileRevision.revisionNumber,
          checksum: fileRevision.checksum
        }));
      }
    },
    _applyPatch: {
      value: function(patch, text) {
        var patchApplied = true;
        var diffs = diffMatchPatch.patch_fromText(patch);
        var result = diffMatchPatch.patch_apply(diffs, text);
        for (var j = 0, jl = result[1].length; j < jl; j++) {
          if (result[1][j] == false) {
            patchApplied = false;
          }
        }
        
        if (patchApplied) {
          text = result[0];
        }
        
        return {
          applied: patchApplied,
          patchedText: text
        };
      }
    },
    
    _sendRevisionToClients: {
      value: function (fileRevision) {
        var clients = getConnectedClients(fileRevision.fileId);
      
        for (var i = clients.length - 1; i >= 0; i--) {
          clients[i].sendRevision(this._clientId, fileRevision);
        }
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
    _acceptPatch: {
      value: function(revisionNumber) {
        this._webSocket.send(JSON.stringify({
          type: 'patchAccepted',
          revisionNumber: revisionNumber
        }));
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
      value: function (file, userId, revisionNumber, patch, checksum, callback) {
        // New revision
        new db.model.FileRevision({ 
          fileId: file._id, 
          userId: userId,
          revisionNumber: revisionNumber, 
          patch: patch, 
          checksum: checksum 
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
        
        db.model.FileContent.findOne({ 'fileId': file._id}, function (err, fileContent) {
          var patchResult = _this._applyPatch(patch, fileContent.content);
          if (patchResult.applied) {
            var checksum = crc.crc32(patchResult.patchedText);
            // Patch applied succesfully
            _this._createRevision(file, userId, patchRevision + 1, patch, checksum, function (err, fileRevision) {
              if (err) {
                fileRevision.remove(function () {
                  _this._rejectPatch(patchRevision, "Failed to create revision: " + err);
                });
              } else {
                fileContent.content = patchResult.patchedText;
                fileContent.save(function (err, fileContent) {
                  if (err) {
                    fileRevision.remove(function () {
                      _this._rejectPatch(patchRevision, "Failed to persist content: " + err);
                    });
                  } else {
                    _this._acceptPatch(fileRevision.revisionNumber);
                    _this._sendRevisionToClients(fileRevision);
                  }
                });
              }
            });
          } else {
            // Patching failed, so we reject the patch
            _this._rejectPatch(patchRevision, "Failed to apply patch");
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
            var client = new Client(clientId, fileId, webSocket);
            webSocket.on('close', function() {
              removeConnectedClient(client);
            });
            
            addConnectedClient(client);
            
            console.log("Client connected. Client count " + getConnectedClients(fileId).length);
            console.log("  fileId:" + fileId); 
            console.log("  userId:" + userId); 
            console.log("  clientId:" + clientId);            
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