'use strict';
const CachedManager = require('./CachedManager');
const InteractionResponse = require('../structures/InteractionResponse');
class InteractionManager extends CachedManager {
  constructor(channel, iterable) {
    super(channel.client, InteractionResponse, iterable);
    this.channel = channel;
  }
  _add(data, cache) {
    data = {
      ...data,
      channelId: this.channel.id,
      guildId: this.channel.guild?.id,
    };
    if (!data.id) return;
    return super._add(data, cache);
  }
}
module.exports = InteractionManager;
