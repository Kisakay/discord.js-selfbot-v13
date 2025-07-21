'use strict';
const GuildChannel = require('./GuildChannel');
class StoreChannel extends GuildChannel {
  constructor(guild, data, client) {
    super(guild, data, client);
    this.nsfw = Boolean(data.nsfw);
  }
  _patch(data) {
    super._patch(data);
    if ('nsfw' in data) {
      this.nsfw = Boolean(data.nsfw);
    }
  }
  createInvite(options) {
    return this.guild.invites.create(this.id, options);
  }
  fetchInvites(cache = true) {
    return this.guild.invites.fetch({ channelId: this.id, cache });
  }
}
module.exports = StoreChannel;
