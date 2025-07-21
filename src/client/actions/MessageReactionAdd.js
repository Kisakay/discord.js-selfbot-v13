'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
const { PartialTypes } = require('../../util/Constants');
class MessageReactionAdd extends Action {
  handle(data, fromStructure = false) {
    if (!data.emoji) return false;
    const user = this.getUserFromMember(data);
    if (!user) return false;
    const channel = this.getChannel({
      id: data.channel_id,
      user_id: data.user_id,
      ...('guild_id' in data && { guild_id: data.guild_id }),
    });
    if (!channel || !channel.isText()) return false;
    const message = this.getMessage(data, channel);
    if (!message) return false;
    const includePartial = this.client.options.partials.includes(PartialTypes.REACTION);
    if (message.partial && !includePartial) return false;
    const reaction = message.reactions._add({
      emoji: data.emoji,
      count: message.partial ? null : 0,
      me: user.id === this.client.user.id,
      ...data,
    });
    if (!reaction) return false;
    reaction._add(user, data.burst);
    if (fromStructure) return { message, reaction, user };
    this.client.emit(Events.MESSAGE_REACTION_ADD, reaction, user, { type: data.type, burst: data.burst });
    return { message, reaction, user };
  }
}
module.exports = MessageReactionAdd;
