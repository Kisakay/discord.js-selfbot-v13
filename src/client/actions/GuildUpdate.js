'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class GuildUpdateAction extends Action {
  handle(data) {
    const client = this.client;
    const guild = client.guilds.cache.get(data.id);
    if (guild) {
      const old = guild._update(data);
      client.emit(Events.GUILD_UPDATE, old, guild);
      return {
        old,
        updated: guild,
      };
    }
    return {
      old: null,
      updated: null,
    };
  }
}
module.exports = GuildUpdateAction;
