'use strict';
const Base = require('./Base');
class Typing extends Base {
  constructor(channel, user, data) {
    super(channel.client);
    this.channel = channel;
    this.user = user;
    this._patch(data);
  }
  _patch(data) {
    if ('timestamp' in data) {
      this.startedTimestamp = data.timestamp * 1_000;
    }
  }
  inGuild() {
    return this.guild !== null;
  }
  get startedAt() {
    return new Date(this.startedTimestamp);
  }
  get guild() {
    return this.channel.guild ?? null;
  }
  get member() {
    return this.guild?.members.resolve(this.user) ?? null;
  }
}
module.exports = Typing;
