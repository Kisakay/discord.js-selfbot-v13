'use strict';
const BaseGuildTextChannel = require('./BaseGuildTextChannel');
const { Error } = require('../errors');
class NewsChannel extends BaseGuildTextChannel {
  async addFollower(channel, reason) {
    const channelId = this.guild.channels.resolveId(channel);
    if (!channelId) throw new Error('GUILD_CHANNEL_RESOLVE');
    await this.client.api.channels(this.id).followers.post({ data: { webhook_channel_id: channelId }, reason });
    return this;
  }
}
module.exports = NewsChannel;
