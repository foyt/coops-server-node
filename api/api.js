(function() {

  ApiResponseBuilder = function() {
    this._messages = new Array();
  };

  ApiResponseBuilder.prototype.addMessage = function(message) {
    this._messages.push(message);
    return this;
  }

  ApiResponseBuilder.prototype.setStatus = function(status) {
    this._status = status;
    return this;
  }

  ApiResponseBuilder.prototype.setResponse = function(response) {
    this._response = response;
    return this;
  }

  ApiResponseBuilder.prototype.build = function() {
    var response = new ApiResponse(this._status, this._response);
    response.setMessages(this._messages);
    return response;
  }

  Api = function(protocolVersion, algorithms, extensions) {
    this._protocolVersion = protocolVersion;
    this._algorithms = algorithms;
    this._extensions = extensions;
  };

  Api.STATUS_OK = 200;
  Api.STATUS_UNAUTHORIZED = 401;
  Api.STATUS_FORBIDDEN = 403;
  Api.STATUS_NOT_FOUND = 404;
  Api.STATUS_CONFLICT = 409;
  Api.STATUS_INTERNAL_SERVER_ERROR = 500;

  Api.prototype.getExtensions = function() {
    return this._extensions;
  };

  Api.prototype.getProtocolVersion = function() {
    return this._protocolVersion;
  };

  Api.prototype.getAlgorithms = function() {
    return this._algorithms;
  };

  Api.prototype.createResponseBuilder = function() {
    return new ApiResponseBuilder();
  };

  Api.prototype.sendResponse = function(res, reponseObject) {
    res.send(reponseObject.toJson());
  };

  ApiResponse = function(status, response) {
    this._status = status;
    this._response = response;
    this._messages = new Array();
  };

  ApiResponse.prototype.getStatus = function() {
    return this._status;
  };

  ApiResponse.prototype.getResponse = function() {
    return this._response;
  };

  ApiResponse.prototype.getMessages = function() {
    return this._messages;
  };

  ApiResponse.prototype.setMessages = function(messages) {
    this._messages = messages;
  };

  ApiResponse.prototype.addMessage = function(message) {
    this._messages.push(message);
  };

  ApiResponse.prototype.toJson = function() {
    return {
      response : this._jsonify(this.getResponse()),
      messages : this.getMessages(),
      status : this.getStatus()
    };
  };

  ApiResponse.prototype._jsonify = function(item) {
    if (item !== undefined) {
      if ((typeof item.toJson) == 'function') {
        return item.toJson();
      } else {
        if (item instanceof Array) {
          var result = new Array();
          for ( var i = 0, l = item.length; i < l; i++) {
            result.push(this._jsonify(item[i]));
          }
          return result;
        } else if ((typeof item) == 'object') {
          var result = {};
          for ( var key in item) {
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

  var ApiBuilder = function() {
  };

  ApiBuilder.prototype.setExtensions = function(extensions) {
    this._extensions = extensions;
    return this;
  };

  ApiBuilder.prototype.setProtocolVersion = function(protocolVersion) {
    this._protocolVersion = protocolVersion;
    return this;
  };

  ApiBuilder.prototype.setAlgorithms = function(algorithms) {
    this._algorithms = algorithms;
    return this;
  };

  ApiBuilder.prototype.build = function() {
    return new Api(this._protocolVersion, this._algorithms, this._extensions);
  };

  module.exports = new ApiBuilder();

}).call(this);