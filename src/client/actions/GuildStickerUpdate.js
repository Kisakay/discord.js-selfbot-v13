'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class GuildStickerUpdateAction extends Action {
  handle(current, data) {
    const old = current._update(data);
    this.client.emit(Events.GUILD_STICKER_UPDATE, old, current);
    return { sticker: current };
  }
}
module.exports = GuildStickerUpdateAction;
