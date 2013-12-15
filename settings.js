(function() {
  
  var UNSECURE_PORT_DEFAULT = 8080;
  var UNSECURE_WEBSOCKET_DEFAULT = "true";
  var SECURE_WEBSOCKET_DEFAULT = "true";
  var UNSECURE_WEBSOCKET_PORT_DEFAULT = 8080;
  var SECURE_WEBSOCKET_PORT_DEFAULT = 8443;
  var MONGO_URI_DEFAULT = 'mongodb://localhost:27017';
  var ADMIN_USERNAME_DEFAULT = "admin";
  var ADMIN_PASSWORD_DEFAULT = "password";

  module.exports = {
    unsecurePort: process.env.COOPS_UNSECURE_PORT || UNSECURE_PORT_DEFAULT,
    securePort: process.env.COOPS_SECURE_PORT,
    secureCert: process.env.COOPS_SECURE_CERT,
    secureCertKey: process.env.COOPS_SECURE_CERT_KEY,
    unsecureWebSocket: (process.env.COOPS_UNSECURE_WEBSOCKET || UNSECURE_WEBSOCKET_DEFAULT) == "true",
    secureWebSocket: (process.env.COOPS_SECURE_WEBSOCKET || SECURE_WEBSOCKET_DEFAULT) == "true",
    unsecureWebSocketPort: process.env.COOPS_UNSECURE_WEBSOCKET_PORT || UNSECURE_WEBSOCKET_PORT_DEFAULT,
    secureWebSocketPort: process.env.COOPS_SECURE_WEBSOCKET_PORT || SECURE_WEBSOCKET_PORT_DEFAULT,
    mongoUri: process.env.COOPS_MONGO_SERVER_URI || process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || MONGO_URI_DEFAULT,
    adminUsername: process.env.COOPS_ADMIN_USERNAME || ADMIN_USERNAME_DEFAULT,
    adminPassword: process.env.COOPS_ADMIN_PASSWORD || ADMIN_PASSWORD_DEFAULT
  };

}).call(this);