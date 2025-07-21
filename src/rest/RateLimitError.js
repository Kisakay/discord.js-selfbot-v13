'use strict';
class RateLimitError extends Error {
  constructor({ timeout, limit, method, path, route, global }) {
    super(`A ${global ? 'global ' : ''}rate limit was hit on route ${route}`);
    this.name = 'RateLimitError';
    this.timeout = timeout;
    this.method = method;
    this.path = path;
    this.route = route;
    this.global = global;
    this.limit = limit;
  }
}
module.exports = RateLimitError;
