'use strict';
const Action = require('./Action');
class GuildEmojisUpdateAction extends Action {
  handle(data) {
    const guild = this.client.guilds.cache.get(data.guild_id);
    if (!guild?.emojis) return;
    const deletions = new Map(guild.emojis.cache);
    for (const emoji of data.emojis) {
      const cachedEmoji = guild.emojis.cache.get(emoji.id);
      if (cachedEmoji) {
        deletions.delete(emoji.id);
        if (!cachedEmoji.equals(emoji)) {
          this.client.actions.GuildEmojiUpdate.handle(cachedEmoji, emoji);
        }
      } else {
        this.client.actions.GuildEmojiCreate.handle(guild, emoji);
      }
    }
    for (const emoji of deletions.values()) {
      this.client.actions.GuildEmojiDelete.handle(emoji);
    }
  }
}
module.exports = GuildEmojisUpdateAction;
