(function() {

  function checkFileRole(req, res, roles, next) {
    if (!req.user) {
      res.send("Unauthorized", 401);
    }
    
    if (req.user._id == req.params.userid) {
      next();
    } else {
      res.send("Forbidden", 403);
    }

    var fileId = req.params.fileid;
    
    db.model.FileUser.findOne({fileId: fileId, userId: userId}, function (err, fileUser) {
      if (err) {
        res.send("Internal Server Error", 500);
      }
      
      if (!fileUser) {
        res.send("Forbidden", 403);
      }
      
      if (roles.indexOf(fileUser.role) == -1) {
        res.send("Forbidden", 403);    
      } else {
        next();
      }
    });  
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
        case 'save-file':
          // User may save a file if role of the user in file is either OWNER or WRITER
          checkFileRole(req, res, ['OWNER', 'WRITER'], next);   
        break;
      };
    };
  };
  
}).call(this);