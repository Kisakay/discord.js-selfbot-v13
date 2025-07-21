'use strict';
class HTTPError extends Error {
  constructor(message, name, code, request) {
    super(message);
    this.name = name;
    this.code = code ?? 500;
    this.method = request.method;
    this.path = request.path;
    this.requestData = {
      json: request.options.data,
      files: request.options.files ?? [],
      headers: request.options.headers,
    };
  }
}
module.exports = HTTPError;
