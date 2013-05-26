(function() {

  var mongoose = require('mongoose');
  mongoose.connect(process.env.COOPS_MONGO_SERVER_URI || process.env.MONGOLAB_URI || process.env.MONGOHQ_URL);
  var db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));
  
  /* AccessTokenSchema */
  
  var AccessTokenSchema = mongoose.Schema({
    token: String,
    refreshToken: String,
    expires: Number,
    userId: mongoose.Schema.Types.ObjectId,
    clientId: mongoose.Schema.Types.ObjectId
  });
  
  /* ClientSchema */

  var ClientSchema = mongoose.Schema({
    name: String,
    clientId: String,
    clientSecret: String
  });
  
  /* UserSchema */
  
  var UserSchema = mongoose.Schema({
    name: String
  });

  /* FileSchema */
  
  var FileSchema = mongoose.Schema({
    name: String,
    modified: Date,
    revisionNumber: Number
  });
  
  var FileContentSchema = mongoose.Schema({
    fileId: mongoose.Schema.Types.ObjectId,
    content: String,
    contentType: String
  });
  
  /* FileUserSchema */
  
  var FileUserSchema = mongoose.Schema({
    fileId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    role: String
  });
  
  /* FileRevisionSchema */
  
  var FileRevisionSchema = mongoose.Schema({
    fileId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    revisionNumber: Number,
    patch: String,
    checksum: Number,
    created: Date
  });
  
  /* WebSocketTokenSchema */
  
  var WebSocketTokenSchema = mongoose.Schema({
    token: String,
    clientId: String
  });
  
  module.exports = {
    model: {
      AccessToken: mongoose.model('AccessToken', AccessTokenSchema),
      Client: mongoose.model('Client', ClientSchema),
      User: mongoose.model('User', UserSchema),
      File: mongoose.model('File', FileSchema),
      FileContent: mongoose.model('FileContent', FileContentSchema),
      FileRevision: mongoose.model('FileRevision', FileRevisionSchema),
      FileUser: mongoose.model('FileUser', FileUserSchema),
      WebSocketToken: mongoose.model('WebSocketToken', WebSocketTokenSchema)
    }
  };
  
}).call(this);