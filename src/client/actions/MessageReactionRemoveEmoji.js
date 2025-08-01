'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class MessageReactionRemoveEmoji extends Action {
  handle(data) {
    const channel = this.getChannel({ id: data.channel_id, ...('guild_id' in data && { guild_id: data.guild_id }) });
    if (!channel || !channel.isText()) return false;
    const message = this.getMessage(data, channel);
    if (!message) return false;
    const reaction = this.getReaction(data, message);
    if (!reaction) return false;
    if (!message.partial) message.reactions.cache.delete(reaction.emoji.id ?? reaction.emoji.name);
    this.client.emit(Events.MESSAGE_REACTION_REMOVE_EMOJI, reaction);
    return { reaction };
  }
}
module.exports = MessageReactionRemoveEmoji;
