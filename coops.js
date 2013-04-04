(function() {

  CoOpsResponseBuilder = function () {
    this._messages = new Array();
  };
  
  CoOpsResponseBuilder.prototype.addMessage = function (message) {
    this._messages.push(message);
    return this;
  }
  
  CoOpsResponseBuilder.prototype.setStatus = function (status) {
    this._status = status;
    return this;
  }
  
  CoOpsResponseBuilder.prototype.setResponse = function (response) {
    this._response = response;
    return this;
  }
  
  CoOpsResponseBuilder.prototype.build = function () {
    var response = new CoOpsResponse(this._status, this._response);
    response.setMessages(this._messages);
    return response;
  }
  

  CoOps = function (protocolVersion, algorithms, extensions) {
    this._protocolVersion = protocolVersion;
    this._algorithms = algorithms;
    this._extensions = extensions;
  };
  
  CoOps.STATUS_OK = 200;
  CoOps.STATUS_UNAUTHORIZED = 401;
  CoOps.STATUS_FORBIDDEN = 403;
  CoOps.STATUS_NOT_FOUND = 404;
  CoOps.STATUS_CONFLICT = 409;
  CoOps.STATUS_INTERNAL_SERVER_ERROR = 500;

  CoOps.prototype.getExtensions = function () {
    return this._extensions;
  };

  CoOps.prototype.getProtocolVersion = function () {
    return this._protocolVersion;
  };
  
  CoOps.prototype.getAlgorithms = function () {
    return this._algorithms;
  };
  
  CoOps.prototype.createResponseBuilder = function () {
    return new CoOpsResponseBuilder();
  };

  CoOps.prototype.sendResponse = function (res, reponseObject) {
    res.send(reponseObject.toJson());
  };

  CoOpsResponse = function (status, response) {
	this._status = status;
	this._response = response;
	this._messages = new Array();
  };
	
  CoOpsResponse.prototype.getStatus = function () {
    return this._status;
  };
	
  CoOpsResponse.prototype.getResponse = function () {
    return this._response;
  };
	
  CoOpsResponse.prototype.getMessages = function () {
    return this._messages;
  };
	
  CoOpsResponse.prototype.setMessages = function (messages) {
	this._messages = messages;
  };
	
  CoOpsResponse.prototype.addMessage = function (message) {
	this._messages.push(message);
  };

  CoOpsResponse.prototype.toJson = function () {
	return {
	  response: this._jsonify(this.getResponse()),
	  messages: this.getMessages(),
	  status: this.getStatus()
	};
  };
  
  CoOpsResponse.prototype._jsonify = function (item) {
    if (item !== undefined) {
      if ((typeof item.toJson) == 'function') {
        return item.toJson();
      } else {
        if (item instanceof Array) {
          var result = new Array();
          for (var i = 0, l = item.length; i < l; i++) {
            result.push(this._jsonify(item[i]));
          }
          return result;
        } else if ((typeof item) == 'object') {
          var result = {};
          for (var key in item) {
            if (item !== null) {
              result[key] = this._jsonify(item[key]);
            }
          }
          return result;
        } 
      }

      return item;
    } else {
      return null;
    }
  };
  
  var CoOpsBuilder = function () {
  };
  
  CoOpsBuilder.prototype.setExtensions = function (extensions) {
    this._extensions = extensions;
    return this;
  };

  CoOpsBuilder.prototype.setProtocolVersion = function (protocolVersion) {
    this._protocolVersion = protocolVersion;
    return this;
  };
  
  CoOpsBuilder.prototype.setAlgorithms = function (algorithms) {
    this._algorithms = algorithms;
    return this;
  };
  
  CoOpsBuilder.prototype.build = function () {
    return new CoOps(this._protocolVersion, this._algorithms, this._extensions);
  };
  
  module.exports = new CoOpsBuilder();
 
}).call(this);