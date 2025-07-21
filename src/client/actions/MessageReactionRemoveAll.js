'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class MessageReactionRemoveAll extends Action {
  handle(data) {
    const channel = this.getChannel({ id: data.channel_id, ...('guild_id' in data && { guild_id: data.guild_id }) });
    if (!channel || !channel.isText()) return false;
    const message = this.getMessage(data, channel);
    if (!message) return false;
    const removed = message.reactions.cache.clone();
    message.reactions.cache.clear();
    this.client.emit(Events.MESSAGE_REACTION_REMOVE_ALL, message, removed);
    return { message };
  }
}
module.exports = MessageReactionRemoveAll;
