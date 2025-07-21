'use strict';
const BaseGuildTextChannel = require('./BaseGuildTextChannel');
class TextChannel extends BaseGuildTextChannel {
  _patch(data) {
    super._patch(data);
    if ('rate_limit_per_user' in data) {
      this.rateLimitPerUser = data.rate_limit_per_user;
    }
  }
  setRateLimitPerUser(rateLimitPerUser, reason) {
    return this.edit({ rateLimitPerUser }, reason);
  }
}
module.exports = TextChannel;
