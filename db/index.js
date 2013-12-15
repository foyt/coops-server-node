(function() {

  var mongoose = require('mongoose');
  var settings = require('../settings');

  mongoose.connect(settings.mongoUri);
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
  });
  
  /* UserPropertySchema */
  
  var UserPropertySchema = mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    key: String,
    value: String
  });

  /* FileSchema */
  
  var FileSchema = mongoose.Schema({
    name: String,
    modified: Date,
    revisionNumber: Number
  });
  
  /* FilePropertySchema */
  
  var FilePropertySchema = mongoose.Schema({
    fileId: mongoose.Schema.Types.ObjectId,
    key: String,
    value: String
  });
  
  /* FileContentSchema */
  
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
    clientId: String,
    revisionNumber: Number,
    patch: String,
    checksum: String,
    created: Date
  });
  
  /* FileRevisionPropertySchema*/
  
  var FileRevisionPropertySchema = mongoose.Schema({
    fileRevisionId: mongoose.Schema.Types.ObjectId,
    key: String,
    value: String
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
      UserProperty: mongoose.model('UserProperty', UserPropertySchema),
      File: mongoose.model('File', FileSchema),
      FileProperty: mongoose.model('FileProperty', FilePropertySchema),
      FileContent: mongoose.model('FileContent', FileContentSchema),
      FileRevision: mongoose.model('FileRevision', FileRevisionSchema),
      FileRevisionProperty: mongoose.model('FileRevisionProperty', FileRevisionPropertySchema),
      FileUser: mongoose.model('FileUser', FileUserSchema),
      WebSocketToken: mongoose.model('WebSocketToken', WebSocketTokenSchema)
    },
    schema: {
      AccessToken: AccessTokenSchema,
      Client: ClientSchema,
      User: UserSchema,
      UserProperty: UserPropertySchema,
      File: FileSchema,
      FileProperty: FilePropertySchema,
      FileContent: FileContentSchema,
      FileRevision: FileRevisionSchema,
      FileRevisionProperty: FileRevisionPropertySchema,
      FileUser: FileUserSchema,
      WebSocketToken: WebSocketTokenSchema
    }
  };

}).call(this);