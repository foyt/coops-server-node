(function() {
  var events = require('events');
  var dao = require('./dao.js');
  var coOps = require('./coops.js')
    .setProtocolVersion("1.0.0draft1")
    .setAlgorithms("dmp")
    .setExtensions([
      'websockets',
      'x-http-method-override'
    ]).build();
    
  function CoOpsExtensionEvent(request, data) {
    this._request = request;
    this._data = data||{};
  };
  
  CoOpsExtensionEvent.prototype = Object.create(null, {
    constructor: {
      value: CoOpsExtensionEvent,
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
  
  function Rest() {
    events.EventEmitter.call(this);
  }
  
  Rest.super_ = events.EventEmitter;
  Rest.prototype = Object.create(events.EventEmitter.prototype, {
    constructor: {
      value: Rest,
      enumerable: false
    },
    
    initialize: {
      value: function(app) {
        var _this = this;

	      function getCompleteFile(file, fileContent) {
	        return {
	          id: file._id,
	          name: file.name,
	          revisionNumber: file.revisionNumber,
	          content: fileContent.content,
	          contentType: fileContent.contentType
	        };
	      }
	
	      app.post('/1/users', function(req, res) {
	        // TODO: Validate params
	        var name = req.query['name'];
	        
	        dao.createUser(name, function (user) {
	          var event = new CoOpsExtensionEvent(req, {
	            user: user
	          });
	                
	          _this.emit("createUser", event);
	          
	          coOps.sendResponse(res,
	            coOps.createResponseBuilder()
	              .setStatus(CoOps.STATUS_OK)
	              .setResponse(event.getData())
	              .build()
	          );
	          
	        });
	      });
	      
	      app.get('/1/users', function(req, res) {
	        dao.listUsers(function (users) {
	          var event = new CoOpsExtensionEvent(req, {
	            users: users
	          });
	                
	          _this.emit("listUsers", event);
	          coOps.sendResponse(res,
	            coOps.createResponseBuilder()
	              .setStatus(CoOps.STATUS_OK)
	              .setResponse(event.getData())
	              .build()
	          );
	        });
	      });
	      
	      app.get('/1/users/:userid', function(req, res) {
	        var userId = req.params.userid;
	
	        dao.getUser(userId, function (user) {
	          var event = new CoOpsExtensionEvent(req, {
	            user: user
	          });
	                
	          _this.emit("getUser", event);
	          coOps.sendResponse(res,
	            coOps.createResponseBuilder()
	              .setStatus(CoOps.STATUS_OK)
	              .setResponse(event.getData())
	              .build()
	          );
	        });
	      });
	      
	      app.post('/1/users/:userid/files', function(req, res) {
	        var userId = req.params.userid;
	        var name = req.query['name'];
	        // TODO: name => post parameter
	        // TODO: Content
	        // TODO: CotnentType
	        
	        dao.createFile(name, function (file) {
	          dao.createFileContent(file._id, '<p>Test</p>', 'text/html', function (fileContent) {
	            dao.createFileUser(file._id, userId, 'OWNER', function (fileUser) {
	              var event = new CoOpsExtensionEvent(req, {
	                file: getCompleteFile(file, fileContent)
	              });
	                    
	              _this.emit("createFile", event);
	              coOps.sendResponse(res,
	                coOps.createResponseBuilder()
	                  .setStatus(CoOps.STATUS_OK)
	                  .setResponse(event.getData())
	                  .build()
	              );
	            });
	          });
	        });
	      });    
	      
	      app.get('/1/users/:userid/files', function(req, res) {
	        var userId = req.params.userid;
	
	        dao.listUserFiles(userId, function (files) {
	          var event = new CoOpsExtensionEvent(req, {
	            files: files
	          });
	 
	          _this.emit("listUserFiles", event);
	          coOps.sendResponse(res,
	            coOps.createResponseBuilder()
	              .setStatus(CoOps.STATUS_OK)
	              .setResponse(event.getData())
	              .build()
	          );
	        });
	      });
	      
	      /* CoOPS --> */
	      
	      /**
	        Client asks to join the collaboration of a document. 
	      **/
	      app.get('/1/users/:userid/files/:fileid/join', function(req, res) {
	        var userId = req.params.userid;
	        var fileId = req.params.fileid;
	
	        // Algorithms supported by the client. 
	        var clientAlgorithms = req.query['algorithm'];
	        if (!(clientAlgorithms instanceof Array)) {
	          clientAlgorithms = Array(clientAlgorithms);
	        }
	        
	        var algorithm = null;
	        var serverAlgorithms = coOps.getAlgorithms();
	        clientAlgorithms.forEach(function (clientAlgorithm) {
	          if (serverAlgorithms.indexOf(clientAlgorithm) > -1) {
	            algorithm = clientAlgorithm;
	          }
	        });
	        
	        // Version of protocol client is using 
	        var protocolVersion = req.query['protocolVersion'];
	        if (coOps.getProtocolVersion() != protocolVersion) {
	          // TODO: Status code
	        
	          coOps.sendResponse(res,
	            coOps.createResponseBuilder()
	              .setStatus(CoOps.STATUS_INTERNAL_SERVER_ERROR)
	              .addMessage("Protocol version mismatch. Client is using " + protocolVersion + " and server " + coOps.getProtocolVersion())
	              .build()
	          );
	        } else {
	          if (algorithm == null) {
	            // TODO: Status code
	            coOps.sendResponse(res,
	              coOps.createResponseBuilder()
	                .setStatus(CoOps.STATUS_INTERNAL_SERVER_ERROR)
	                .addMessage("Server and client do not have a commonly supported algorithm. Server supported: " + serverAlgorithms + ", client supported: " + clientAlgorithms)
	                .build()
	            );
	          } else {
	            // TODO: Security
	            // TODO: If user is not logged in: CoOps.STATUS_UNAUTHORIZED
	            // TODO: If user has no permission to file: CoOps.STATUS_FORBIDDEN
	
	            dao.createSession(fileId, userId, algorithm, function (session) {
	              var event = new CoOpsExtensionEvent(req, {
	                session: session,
	                extensions: coOps.getExtensions()
	              });
	                
	              _this.emit("fileJoin", event);
	              coOps.sendResponse(res,
	                coOps.createResponseBuilder()
	                  .setStatus(CoOps.STATUS_OK)
	                  .setResponse(event.getData())
	                  .build()
	              );    
	            });
	          }
	        }
	      });
	
	      app.get('/1/users/:userid/files/:fileid', function(req, res) {
	        // TODO: Security
	        var userId = req.params.userid;
	        var fileId = req.params.fileid;
	        // TODO: Better param name?
	        var revision = req.query['revision'];
	        
	        if (revision === undefined) {
	          dao.getFile(fileId, function (file) {
	            dao.getFileContent(fileId, function (fileContent) {
	              var completeFile = getCompleteFile(file, fileContent);
	              var event = new CoOpsExtensionEvent(req, {
	                file: completeFile
	              });
	 
	              _this.emit("getFile", event);
	              coOps.sendResponse(res,
	                coOps.createResponseBuilder()
	                  .setStatus(CoOps.STATUS_OK)
	                  .setResponse(event.getData())
	                  .build()
	              );            
	            });
	        });
	        
	        } else {
	          res.send("TODO: Load documnent changes: " + userId + "," + fileId + "," + revision);
	        }
	        
	      });      
	      
	      app.put('/1/users/:userid/files/:fileid', function(req, res) {
	        // save
	        var userId = req.params.userid;
	        var fileId = req.params.fileid;
	
	        res.send("Save complete doc: " + userId + "," + fileId);
	      });      
	      
	      app.patch('/1/users/:userid/files/:fileid', function(req, res) {
	        // patch
	        // json post: revision
	        // json post: patch
	        // json post: properties
	        
	        var userId = req.params.userid;
	        var fileId = req.params.fileid;
	
	        res.send("Patch doc: " + userId + "," + fileId);
	      });      
	
	      /* <-- CoOPS */
	    }
	  }
    }
  );

  module.exports = new Rest();
  
}).call(this);