/**
 * Module dependencies.
 */
var passport = require('passport');
var BearerStrategy = require('passport-http-bearer').Strategy;
var BasicStrategy = require('passport-http').BasicStrategy;
var ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy;
var util = require('util');

var db = require('./db');
var settings = require('./settings');

/**
 * BearerStrategy
 * 
 * This strategy is used to authenticate users based on an access token (aka a bearer token). The user must have previously authorized a client application,
 * which is issued an access token to make requests on behalf of the authorizing user.
 */
passport.use(new BearerStrategy(function(accessToken, done) {
  db.model.AccessToken.findOne({
    token : accessToken
  }, function(err, token) {
    if (err) {
      return done(err, false);
    }

    if (!token) {
      return done(null, false);
    }
    
    if (token.expires < new Date().getTime()) {
      return done(null, false);
    }

    db.model.User.findOne({
      _id : token.userId
    }, function(err, user) {
      if (err) {
        return done(err);
      }

      if (!user) {
        return done(null, false);
      }

      var info = {
        scope : '*'
      };

      done(null, user, info);
    });
  });
}));

passport.use(new BasicStrategy(function(username, password, done) {
  db.model.Client.findOne({
    clientId : username,
    clientSecret : password
  }, function(err, client) {
    if (err) {
      return done(err);
    }

    if (!client) {
      return done(null, false);
    }

    return done(null, client);
  });
}));

passport.use(new ClientPasswordStrategy(function(clientId, clientSecret, done) {
  db.model.Client.findOne({
    clientId : clientId,
    clientSecret : clientSecret
  }, function(err, client) {
    if (err) {
      return done(err);
    }

    if (!client) {
      return done(null, false);
    }

    return done(null, client);
  });
}));

function AdminStrategy(options, verify) {
  if (typeof options == 'function') {
    verify = options;
    options = {};
  }
  if (!verify) throw new Error('HTTP Basic authentication strategy requires a verify function');
  
  passport.Strategy.call(this);
  this.name = 'admin';
  this._verify = verify;
  this._realm = 'Admins';
};

util.inherits(AdminStrategy, BasicStrategy);

passport.use(new AdminStrategy(function(username, password, done) {
  if ((settings.adminUsername == username) && (settings.adminPassword == password)) {
    return done(null, {
      user: 'admin'
    });
  } else {
    return done(null, false);
  }
}));
