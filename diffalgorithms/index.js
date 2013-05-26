(function() {
  
  var dmp = require('./dmp');
  
  module.exports.getAlgorithms = function () {
    return ['dmp'];
  }
  
  module.exports.getAlgorithm = function (name) {
    return new dmp(); 
  }
  
}).call(this);