'use strict';
const BaseGuildEmoji = require('./BaseGuildEmoji');
class GuildPreviewEmoji extends BaseGuildEmoji {
  constructor(client, data, guild) {
    super(client, data, guild);
    this.roles = data.roles;
  }
}
module.exports = GuildPreviewEmoji;
