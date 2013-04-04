(function() {
  
  var database = require('./database.js');
    
  function CoOpsDAO() {
  }
      
  CoOpsDAO.prototype = Object.create(null, {
    constructor: {
      value: CoOpsDAO,
      enumerable: false
    },
    
    // Users
    
    createUser: {
      value: function (name, callback) {
        var newUser = new database.model.User({
          name: name
        });

        newUser.save(function (err, user) {
          if (err) {
            // TODO: Error handling...
          } else {
            callback(user);
          }
        });
      }
    },
    
    getUser: {
      value: function (id, callback) {
        database.model.User.findOne({ _id: id },function (err, user) {
          callback(user);
        });
      }
    },
    
    listUsers: {
      value: function (callback) {
        database.model.User.find(function (err, users) {
          if (err) {
            // TODO: Error handling...
          } else {
            callback(users);
          }
        })
      }
    },
    
    /* Files */
    
    createFile: {
      value: function (name, callback) {
        var newFile = new database.model.File({
          name: name,
          revisionNumber: 0
        });

        newFile.save(function (err, file) {
          if (err) {
            // TODO: Error handling...
          } else {
            callback(file);
          }
        });
      }
    },
    
    getFile: {
      value: function (id, callback) {
        database.model.File.findOne({ _id: id },function (err, file) {
          if (err) {
            // TODO: Error handling...
            onsole.log(err);
          } else {
            callback(file);
          }
        });
      }
    },    
    
    getFiles: {
      value: function (ids, callback) {
        database.model.File.find({ '_id': { $in: ids} }, function (err, files) {
          if (err) {
            // TODO: Error handling...
          } else {
            callback(files);
          }
        });
      }
    },    
    
    listUserFiles: {
      value: function (userId, callback) {
        var _this = this;

        database.model.FileUser.find({ userId: userId }, 
          function (err, fileUsers) {
            if (err) {
              // TODO: Error handling...
            } else {
              var fileIds = new Array();
              fileUsers.forEach(function (fileUser) {
                fileIds.push(fileUser.fileId);
              });
          
              _this.getFiles(fileIds, function (files) {
                callback(files);
              });
            }
          }
        );
      }
    },   
    
    updateFileRevisionNumber: {
      value: function (file, revisionNumber, callback) {
        file.revisionNumber = revisionNumber;
        
        file.save(function (err, updatedFile) {
          if (err) {
            // TODO: Error handling...
          } else {
            callback(updatedFile);
          }
        });
      }
    },
    
    joinFile: {
      value: function (userId, fileId, callback) {
        database.model.FileUser.find({ userId: userId, fileId: fileId }, 
          function (err, fileUser) {
            if (err) {
              // TODO: Error handling...
            } else {
            }
          }
        );
      } 
    }, 
    
    /* FileUsers */
    
    createFileUser: {
      value: function (fileId, userId, role, callback) {
        var newFileUser = new database.model.FileUser({
          fileId: fileId,
          userId: userId,
          role: role
        });

        newFileUser.save(function (err, fileUser) {
          if (err) {
            // TODO: Error handling...
          } else {
            callback(fileUser);
          }
        });
      }
    },
    
    /* FileContent */
    
    createFileContent: {
      value: function (fileId, content, contentType, callback) {
        var newFileContent = new database.model.FileContent({
          fileId: fileId,
          content: content,
          contentType: contentType
        });

        newFileContent.save(function (err, fileContent) {
          if (err) {
            // TODO: Error handling...
          } else {
            callback(fileContent);
          }
        });
      }
    },
    
    getFileContent: {
      value: function (fileId, callback) {
        database.model.FileContent.findOne({ fileId: fileId },function (err, fileContent) {
          if (err) {
            // TODO: Error handling...
            onsole.log(err);
          } else {
            callback(fileContent);
          }
        });
      }
    },   
    
    updateFileContentContent: {
      value: function (fileContent, content, callback) {
        fileContent.content = content;
        
        fileContent.save(function (err, fileContent) {
          if (err) {
            // TODO: Error handling...
          } else {
            callback(fileContent);
          }
        });
      }
    },
    
    /* FileRevision */
    
    createFileRevision: {
      value: function (fileId, revisionNumber, patch, callback) {
        var newFileRevision = new database.model.FileRevision({
          fileId: fileId,
          revisionNumber: revisionNumber,
          patch: patch
        });
    
        newFileRevision.save(function (err, fileRevision) {
          if (err) {
            // TODO: Error handling...
          } else {
            callback(fileRevision);
          }
        });
      }
    },

    /* Session */
    
    createSession: {
      value: function (fileId, userId, algorithm, callback) {
        var session = new database.model.Session({
          fileId: fileId,
          userId: userId,
          algorithm: algorithm
        });
    
        session.save(function (err, session) {
          if (err) {
            // TODO: Error handling...
          } else {
            callback(session);
          }
        });
      }
    }
  });
  
  module.exports = new CoOpsDAO();
 
}).call(this);