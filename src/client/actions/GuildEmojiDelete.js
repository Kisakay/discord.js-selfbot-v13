'use strict';
const Action = require('./Action');
const { deletedEmojis } = require('../../structures/Emoji');
const { Events } = require('../../util/Constants');
class GuildEmojiDeleteAction extends Action {
  handle(emoji) {
    emoji.guild.emojis.cache.delete(emoji.id);
    deletedEmojis.add(emoji);
    this.client.emit(Events.GUILD_EMOJI_DELETE, emoji);
    return { emoji };
  }
}
module.exports = GuildEmojiDeleteAction;
