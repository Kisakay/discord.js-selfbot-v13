'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class GuildStickerCreateAction extends Action {
  handle(guild, createdSticker) {
    const already = guild.stickers.cache.has(createdSticker.id);
    const sticker = guild.stickers._add(createdSticker);
    if (!already) this.client.emit(Events.GUILD_STICKER_CREATE, sticker);
    return { sticker };
  }
}
module.exports = GuildStickerCreateAction;
