var db = require("./db");
var utils = require('./utils');

exports.index = function (req, res) {
  res.render('index');
};

exports.setupClients = function (req, res) {
  db.model.Client.find(function (err, clients) {
    if (err) {
      throw err;
    } else {
      res.render('setup-clients', { clients: clients });
    }
  });
};

exports.setupAddClient = function (req, res) {
  res.render('setup-add-client');
};

exports.setupEditClient = function (req, res) {
  var id = req.query['id'];
  db.model.Client.findOne({_id: id}, function (err, client) {
    if (err) {
      throw err;
    } else {
      res.render('setup-edit-client', {oAuthClient: client });      
    } 
  }); 
};

exports.setupCreateClient = function (req, res) {
  var name = req.body['name'];
  // var redirectUrl = req.body['redirectUrl'];
  
  var client = new db.model.Client();
  client.name = name;
  client.clientId = utils.uid(256);
  client.clientSecret = utils.uid(256);
  client.save(function (err, client) {
    if (err) {
      throw new err;
    }
    
    res.redirect("/setup/clients");
  });
};

exports.setupModifyClient = function (req, res) {
  var id = req.body['id'];
  var name = req.body['name'];
  
  db.model.Client.findOne({_id: id}, function (err, client) {
    client.name = name;
    client.save(function (err, client) {
      if (err) {
        throw new err;
      }
      
      res.redirect("/setup/clients");
    });
  });
};