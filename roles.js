(function() {
  
  var db = require('./db');

  function checkFileRole(req, res, roles, next) {
    if (!req.user) {
      res.send("Unauthorized", 401);
    } else {
      if (req.user._id != req.params.userid) {
        res.send("User does not match logged user", 403);
      } else {
        var fileId = req.params.fileid;
        
        db.model.FileUser.findOne({fileId: fileId, userId: req.user._id}, function (err, fileUser) {
          if (err) {
            console.error(err);
            res.send("Internal Server Error", 500);
          }
          
          if (!fileUser) {
            res.send("User has no role in file", 403);
          } else {
            if (roles.indexOf(fileUser.role) == -1) {
              res.send("User lacks required role", 403);    
            } else {
              next();
            }
          }
        });  
      }
    }
  }
  
  module.exports.can = function (action) {
    return function(req, res, next) {
      switch (action) {
        case 'get-user-info':
          // User may view his/her own information
          
          if (!req.user) {
            res.send("Unauthorized", 401);
          }
    
          // TODO: Administrators may view information of other users
          
          if (req.user._id == req.params.userid) {
            next();
          } else {
            res.send("Forbidden", 403);
          }
        break;
        case 'create-new-file':
          // User may create new file for himself/herself
          
          if (!req.user) {
            res.send("Unauthorized", 401);
          }
    
          // TODO: Administrators may add files for other users
          
          if (req.user._id == req.params.userid) {
            next();
          } else {
            res.send("Forbidden", 403);
          }
        break;
        case 'list-files':
          // User may list his/her own files
          
          if (!req.user) {
            res.send("Unauthorized", 401);
          }
    
          // TODO: Administrators may list files of other users
          
          if (req.user._id == req.params.userid) {
            next();
          } else {
            res.send("Forbidden", 403);
          }
        break;
        case 'join-file':
          // User may join session if role of the user in file is either OWNER or WRITER
          checkFileRole(req, res, ['OWNER', 'WRITER'], next);     
        break;
        case 'get-file':
          // User may view file if role of the user in file is either OWNER, WRITER or READER
          checkFileRole(req, res, ['OWNER', 'WRITER', 'READER'], next);   
        break;
        case 'get-file-users':
          // User may list file users if role of the user in file is either OWNER, WRITER or READER
          checkFileRole(req, res, ['OWNER', 'WRITER', 'READER'], next);   
        break;
        case 'get-file-revisions':
          // User may list file revisions, if role of the user in file is either OWNER, WRITER or READER
          checkFileRole(req, res, ['OWNER', 'WRITER', 'READER'], next);   
        break;
        case 'update-file-users':
          // User may list file users if role of the user in file is either OWNER, WRITER or READER
          checkFileRole(req, res, ['OWNER', 'WRITER'], next);   
        break;
        case 'save-file':
          // User may save a file if role of the user in file is either OWNER or WRITER
          checkFileRole(req, res, ['OWNER', 'WRITER'], next);   
        break;
      };
    };
  };
  
}).call(this);