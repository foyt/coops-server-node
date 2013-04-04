(function() {
  var mongoose = require('mongoose');
  mongoose.connect('mongodb://localhost/coops');
  var db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));
  
  /* UserSchema */
  
  var UserSchema = mongoose.Schema({
    name: String
  });
  
  UserSchema.methods.toJson = function () {
    return {
      id: this._id,
      name: this.name
    };
  };
  
  /* SessionSchema */
  
  var SessionSchema = mongoose.Schema({
    fileId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    algorithm: String
  });
  
  SessionSchema.methods.toJson = function () {
    return {
      id: this._id,
      fileId: this.fileId,
      userId: this.userId,
      algorithm: this.algorithm
    };
  };
  
  /* FileSchema */
  
  var FileSchema = mongoose.Schema({
    name: String,
    revisionNumber: Number
  });
  
  FileSchema.methods.toJson = function () {
    return {
      id: this._id,
      name: this.name,
      revisionNumber: this.revisionNumber
    };
  };
  
  var FileContentSchema = mongoose.Schema({
    fileId: mongoose.Schema.Types.ObjectId,
    content: String,
    contentType: String
  });
  
  FileContentSchema.methods.toJson = function () {
    return {
      content: this.content,
      contentType: this.contentType
    };
  };
  
  /* FileUserSchema */
  
  var FileUserSchema = mongoose.Schema({
    fileId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    role: String
  });
  
  FileUserSchema.methods.toJson = function () {
    return {
      id: this._id,
      fileId: this.fileId,
      userId: this.userId,
      role: this.role
    };
  };
  
  /* FileRevisionSchema */
  
  var FileRevisionSchema = mongoose.Schema({
    fileId: mongoose.Schema.Types.ObjectId,
    revisionNumber: Number,
    patch: String
  });
  
  FileRevisionSchema.methods.toJson = function () {
    return {
      id: this._id,
      fileId: this.fileId,
      revisionNumber: this.revisionNumber,
      patch: this.patch,
      complete: Boolean
    };
  };
  
  module.exports = {
    model: {
      User: mongoose.model('User', UserSchema),
      File: mongoose.model('File', FileSchema),
      FileContent: mongoose.model('FileContent', FileContentSchema),
      FileRevision: mongoose.model('FileRevision', FileRevisionSchema),
      FileUser: mongoose.model('FileUser', FileUserSchema),
      Session: mongoose.model('Session', SessionSchema)
    }
  };
  
}).call(this);