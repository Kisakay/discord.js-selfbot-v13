'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class GuildIntegrationsUpdate extends Action {
  handle(data) {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    if (guild) client.emit(Events.GUILD_INTEGRATIONS_UPDATE, guild);
  }
}
module.exports = GuildIntegrationsUpdate;
