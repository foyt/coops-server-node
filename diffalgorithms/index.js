(function() {
  
  var dmp = require('./dmp');
  
  module.exports.getAlgorithms = function () {
    return ['dmp'];
  }
  
  module.exports.getAlgorithm = function (name) {
    return new dmp(); 
  }
  
  module.exports.isAlgorithmAvailable = function (name) {
    return this.getAlgorithms().indexOf(name) != -1;
  }
  
}).call(this);