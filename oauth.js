(function() {

  var db = require('./db');
  var crypto = require('crypto');
  
  exports.token = function (req, res) {
    var refreshToken = req.body['refresh_token'];
    var grantType = req.body['grant_type'];
    var client = req.user;
    
    if (grantType == 'refresh_token') {
      // Find access token by refresh token
      db.model.AccessToken.findOne({ "refreshToken": refreshToken }, function (err, accessToken) {
        if (err) {
          res.send(err, 500);
        } else {
          if (accessToken) {
            if (accessToken.clientId.equals(client._id)) {
              // Access token found with refreshToken, generating new token and expire time
              var expireTime = 1000 * 60 * 60 * 24;
              accessToken.token = crypto.randomBytes(64).toString('hex');
              accessToken.expires = expireTime + new Date().getTime();
              accessToken.save(function (err, savedAccessToken) {
                var response = {
                  "access_token": savedAccessToken.token,
                  "token_type": "Bearer",
                  "expires_in":  savedAccessToken.expires - new Date().getTime()
                };
  
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.send(JSON.stringify(response));
              });
            } else {
              // Refresh token is not for this client, unauthorized
              res.send(err, 401);
            }
          } else {
            // Access token could not be found, unauthorized
            res.send(err, 401);
          }
        }
      });
      
    } else {
      res.send('grant_type must be refresh_token', 500);
    } 
  };
  
}).call(this);