(function() {
  
  var diffMatchPatchMod = require('googlediff');
  var diffMatchPatch = new diffMatchPatchMod();
  
  var WebSocketServer = require('ws').Server;
  var events = require('events');
  var dao = require('./dao.js');
  var connectedClients = new Array();
  
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
    
    this.on("receiveSelection", function (event) {
      _this._onReceiveSelection(event);
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
    sendRevision: {
      value: function(fileRevision) {
        this._webSocket.send(JSON.stringify({
          type: 'patch',
          patch: fileRevision.patch,
          revisionNumber: fileRevision.revisionNumber
        }));
      }
    },
    sendSelectionChange: {
      value: function(data) {
        this._webSocket.send(JSON.stringify({
          type: 'selection',
          clientId: data.clientId,
          selections: data.selections,
          revisionNumber: data.revisionNumber
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
    
    _sendRevisionToOthers: {
      value: function (fileRevision) {
        for (var i = connectedClients.length - 1; i >= 0; i--) {
          if (connectedClients[i] !== this) {
            connectedClients[i].sendRevision(fileRevision);
          }
        }
      }
    },
    
    _sendSelectionToOthers: {
      value: function (data) {
        for (var i = connectedClients.length - 1; i >= 0; i--) {
          if (connectedClients[i] !== this) {
            connectedClients[i].sendSelectionChange(data);
          }
        }
        
      }
    },
    
    _onWebSocketMessage: {
      value: function(data, flags) {
        // flags.binary will be set if a binary data is received
        // flags.masked will be set if the data was masked
        
        var json = JSON.parse(data);
        
        switch (json.type) {
          case 'patch':
            this.emit("receivePatch", {
              patch: json.patch,
              revisionNumber: json.revisionNumber
            });
          break;
          case 'selection':
            this.emit("receiveSelection", {
              selections: json.selections,
              revisionNumber: json.revisionNumber
            });
          break;
        }
      }
    },
    _acceptPatch: {
      value: function(revisionNumber) {
        console.log("patchAccepted");
      
        this._webSocket.send(JSON.stringify({
          type: 'patchAccepted',
          revisionNumber: revisionNumber
        }));
      }
    },
    _rejectPatch: {
      value: function(revisionNumber, reason) {
        console.log("patchRejected: " + reason);

        this._webSocket.send(JSON.stringify({
          type: 'patchRejected',
          revisionNumber: revisionNumber,
          reason: reason
        }));
      }
    },
    
    _createRevision: {
      value: function (file, revisionNumber, patch, callback) {
        // New revision
        dao.createFileRevision(file._id, revisionNumber, patch, function (fileRevision) {
          // Update document revision
          dao.updateFileRevisionNumber(file, revisionNumber, function (updatedFile) {
            callback(fileRevision, updatedFile);
          });
        });
      }
    },
    
    _patchFile: {
      value: function (file, patchRevision, patch) {
        var _this = this;
        
        dao.getFileContent(file._id, function (fileContent) {
          console.log("Applying patch...");
        
          var patchResult = _this._applyPatch(patch, fileContent.content);
          if (patchResult.applied) {
            // Patch applied succesfully
            _this._createRevision(file, patchRevision + 1, patch, function (fileRevision, updatedFile) {
              dao.updateFileContentContent(fileContent, patchResult.patchedText, function (updateFileContent) {
                _this._acceptPatch(updatedFile.revisionNumber);
                _this._sendRevisionToOthers(fileRevision);
              });  
            });
          } else {
            // Patching failed, so we reject the patch
            _this._rejectPatch(patchRevision, "PATCH_FAILED");
          }
        });
      }
    },
    
    _onReceivePatch: {
      value: function (event) {
	    var patch = event.patch;
	    var patchRevision = event.revisionNumber;
   
        var _this = this;
        dao.getFile(this._fileId, function (file) {
          if (file.revisionNumber == patchRevision) {
            // Patch is to this revision so we can accept it
            _this._patchFile(file, patchRevision, patch);          
          } else {
            // Patch is not to this revision, so we reject it
            _this._rejectPatch(patchRevision, "OUT_OF_SYNC");
          }
        });
	  }
    },
    
    _onReceiveSelection: {
      value: function (event) {
        var selections = event.selections;
        var patchRevision = event.revisionNumber;
        
        this._sendSelectionToOthers({
          selections: selections,
          patchRevision: patchRevision,
          clientId: this._clientId
        });  
      }
    }
  });

  var clientIdCounter = new Date().getTime();
   
  module.exports = {
    initialize: function(server) {
      var webSocketServer = new WebSocketServer({
        server: server
      });

      webSocketServer.on('connection', function(webSocket) {
        // TODO: from session
        var fileId = '513b767427c5726a04000002';
        var clientId = (clientIdCounter++);
      
        var client = new Client(clientId, fileId, webSocket);
        webSocket.on('close', function() {
          for (var i = connectedClients.length - 1; i >= 0; i--) {
            if (connectedClients[i] === client) {
              connectedClients.splice(i, 1);
              break;
            } 
          }

          client.deinitialize();
        });
        
        connectedClients.push(client);
        
        console.log("Client connected. Client count " + connectedClients.length);
      });
    }
  };
  
}).call(this);