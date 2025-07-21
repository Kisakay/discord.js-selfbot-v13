'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class GuildEmojiUpdateAction extends Action {
  handle(current, data) {
    const old = current._update(data);
    this.client.emit(Events.GUILD_EMOJI_UPDATE, old, current);
    return { emoji: current };
  }
}
module.exports = GuildEmojiUpdateAction;
