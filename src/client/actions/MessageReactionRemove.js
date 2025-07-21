'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class MessageReactionRemove extends Action {
  handle(data) {
    if (!data.emoji) return false;
    const user = this.getUser(data);
    if (!user) return false;
    const channel = this.getChannel({
      id: data.channel_id,
      user_id: data.user_id,
      ...('guild_id' in data && { guild_id: data.guild_id }),
    });
    if (!channel || !channel.isText()) return false;
    const message = this.getMessage(data, channel);
    if (!message) return false;
    const reaction = this.getReaction(data, message, user);
    if (!reaction) return false;
    reaction._remove(user, data.burst);
    this.client.emit(Events.MESSAGE_REACTION_REMOVE, reaction, user, { type: data.type, burst: data.burst });
    return { message, reaction, user };
  }
}
module.exports = MessageReactionRemove;
