'use strict';
const Base = require('./Base');
const { Emoji } = require('./Emoji');
class WelcomeChannel extends Base {
  constructor(guild, data) {
    super(guild.client);
    this.guild = guild;
    this.description = data.description;
    this._emoji = {
      name: data.emoji_name,
      id: data.emoji_id,
    };
    this.channelId = data.channel_id;
  }
  get channel() {
    return this.client.channels.cache.get(this.channelId) ?? null;
  }
  get emoji() {
    return this.client.emojis.cache.get(this._emoji.id) ?? new Emoji(this.client, this._emoji);
  }
}
module.exports = WelcomeChannel;
