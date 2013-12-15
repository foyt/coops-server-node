(function() {
  
  function TosstableDifferenceAlgorithm() {
    
  }

  TosstableDifferenceAlgorithm.prototype = Object.create(null, {
    constructor: {
      value: TosstableDifferenceAlgorithm,
      enumerable: false
    },
    name: {
      value: function(original, modified) {
        return 'tosstable';
      }
    },
    patch: {
      value: function(patch, text) {
        return {
          applied: true, // or false
          patchedText: '' // pached
        };
      }
    },
    unpatch: {
      value: function(patch, text) {
        return {
          applied: true, // or false 
          patchedText: '' // unpatched
        };
      }
    },
    makePatch: {
      value: function(original, modified) {
        return ''; // patch 
      }
    }
  });
  
  exports.attach = function attach(options) {
    options.diffAlgorithms.push(new TosstableDifferenceAlgorithm());
  };
  
  exports.init = function (done) {
    return done();
  };
  
}).call(this);