'use strict';
const { setTimeout } = require('node:timers');
const Action = require('./Action');
const { deletedGuilds } = require('../../structures/Guild');
const { Events } = require('../../util/Constants');
class GuildDeleteAction extends Action {
  constructor(client) {
    super(client);
    this.deleted = new Map();
  }
  handle(data) {
    const client = this.client;
    let guild = client.guilds.cache.get(data.id);
    if (guild) {
      if (data.unavailable) {
        guild.available = false;
        client.emit(Events.GUILD_UNAVAILABLE, guild);
        return {
          guild: null,
        };
      }
      for (const channel of guild.channels.cache.values()) this.client.channels._remove(channel.id);
      client.guilds.cache.delete(guild.id);
      deletedGuilds.add(guild);
      client.emit(Events.GUILD_DELETE, guild);
      this.deleted.set(guild.id, guild);
      this.scheduleForDeletion(guild.id);
    } else {
      guild = this.deleted.get(data.id) ?? null;
    }
    return { guild };
  }
  scheduleForDeletion(id) {
    setTimeout(() => this.deleted.delete(id), this.client.options.restWsBridgeTimeout).unref();
  }
}
module.exports = GuildDeleteAction;
