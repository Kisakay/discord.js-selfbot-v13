'use strict';
const Action = require('./Action');
const GuildBan = require('../../structures/GuildBan');
const { Events } = require('../../util/Constants');
class GuildBanRemove extends Action {
  handle(data) {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    if (guild) {
      const ban = guild.bans.cache.get(data.user.id) ?? new GuildBan(client, data, guild);
      guild.bans.cache.delete(ban.user.id);
      client.emit(Events.GUILD_BAN_REMOVE, ban);
    }
  }
}
module.exports = GuildBanRemove;
