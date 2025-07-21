'use strict';
const Action = require('./Action');
class GuildStickersUpdateAction extends Action {
  handle(data) {
    const guild = this.client.guilds.cache.get(data.guild_id);
    if (!guild?.stickers) return;
    const deletions = new Map(guild.stickers.cache);
    for (const sticker of data.stickers) {
      const cachedSticker = guild.stickers.cache.get(sticker.id);
      if (cachedSticker) {
        deletions.delete(sticker.id);
        if (!cachedSticker.equals(sticker)) {
          this.client.actions.GuildStickerUpdate.handle(cachedSticker, sticker);
        }
      } else {
        this.client.actions.GuildStickerCreate.handle(guild, sticker);
      }
    }
    for (const sticker of deletions.values()) {
      this.client.actions.GuildStickerDelete.handle(sticker);
    }
  }
}
module.exports = GuildStickersUpdateAction;
