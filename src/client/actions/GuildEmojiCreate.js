'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class GuildEmojiCreateAction extends Action {
  handle(guild, createdEmoji) {
    const already = guild.emojis.cache.has(createdEmoji.id);
    const emoji = guild.emojis._add(createdEmoji);
    if (!already) this.client.emit(Events.GUILD_EMOJI_CREATE, emoji);
    return { emoji };
  }
}
module.exports = GuildEmojiCreateAction;
