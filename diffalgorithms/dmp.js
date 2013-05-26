(function() {
  
  var diffMatchPatchMod = require('googlediff');
  var diffMatchPatch = new diffMatchPatchMod();

  function DmpDifferenceAlgorithm() {
    
  }

  DmpDifferenceAlgorithm.prototype = Object.create(null, {
    constructor: {
      value: DmpDifferenceAlgorithm,
      enumerable: false
    },
    patch: {
      value: function(patch, text) {
        var patchApplied = true;
        var patches = diffMatchPatch.patch_fromText(patch);
        var result = diffMatchPatch.patch_apply(patches, text);
        for (var j = 0, jl = result[1].length; j < jl; j++) {
          if (result[1][j] == false) {
            patchApplied = false;
          }
        }
        
        if (patchApplied) {
          text = result[0];
        }
        
        return {
          applied: patchApplied,
          patchedText: text
        };
      }
    },
    unpatch: {
      value: function(patch, text) {
        var patchApplied = true;
        var patches = diffMatchPatch.patch_fromText(patch);

        // Switch places of DIFF_DELETE and DIFF_INSERT
        for (var patchIndex = 0, patchesLength = patches.length; patchIndex < patchesLength; patchIndex++) {
          for (var diffIndex = 0, diffsLength = patches[patchIndex].diffs.length; diffIndex < diffsLength; diffIndex++) {
            patches[patchIndex].diffs[diffIndex][0] *= -1;
          }
        }

        var result = diffMatchPatch.patch_apply(patches, text);
        for (var j = 0, jl = result[1].length; j < jl; j++) {
          if (result[1][j] == false) {
            patchApplied = false;
          }
        }
        
        if (patchApplied) {
          text = result[0];
        }
        
        return {
          applied: patchApplied,
          patchedText: text
        };
      }
    }
  });
  
  module.exports = DmpDifferenceAlgorithm;
  
}).call(this);