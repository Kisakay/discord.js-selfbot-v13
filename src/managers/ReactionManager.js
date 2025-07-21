'use strict';
const CachedManager = require('./CachedManager');
const MessageReaction = require('../structures/MessageReaction');
class ReactionManager extends CachedManager {
  constructor(message, iterable) {
    super(message.client, MessageReaction, iterable);
    this.message = message;
  }
  _add(data, cache) {
    return super._add(data, cache, { id: data.emoji.id ?? data.emoji.name, extras: [this.message] });
  }
  async removeAll() {
    await this.client.api.channels(this.message.channelId).messages(this.message.id).reactions.delete();
    return this.message;
  }
}
module.exports = ReactionManager;
