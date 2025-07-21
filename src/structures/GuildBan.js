'use strict';
const Base = require('./Base');
class GuildBan extends Base {
  constructor(client, data, guild) {
    super(client);
    this.guild = guild;
    this._patch(data);
  }
  _patch(data) {
    if ('user' in data) {
      this.user = this.client.users._add(data.user, true);
    }
    if ('reason' in data) {
      this.reason = data.reason;
    }
  }
  get partial() {
    return !('reason' in this);
  }
  fetch(force = true) {
    return this.guild.bans.fetch({ user: this.user, cache: true, force });
  }
}
module.exports = GuildBan;
