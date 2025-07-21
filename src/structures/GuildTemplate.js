'use strict';
const { setTimeout } = require('node:timers');
const Base = require('./Base');
const { Events } = require('../util/Constants');
const DataResolver = require('../util/DataResolver');
class GuildTemplate extends Base {
  constructor(client, data) {
    super(client);
    this._patch(data);
  }
  _patch(data) {
    if ('code' in data) {
      this.code = data.code;
    }
    if ('name' in data) {
      this.name = data.name;
    }
    if ('description' in data) {
      this.description = data.description;
    }
    if ('usage_count' in data) {
      this.usageCount = data.usage_count;
    }
    if ('creator_id' in data) {
      this.creatorId = data.creator_id;
    }
    if ('creator' in data) {
      this.creator = this.client.users._add(data.creator);
    }
    if ('created_at' in data) {
      this.createdAt = new Date(data.created_at);
    }
    if ('updated_at' in data) {
      this.updatedAt = new Date(data.updated_at);
    }
    if ('source_guild_id' in data) {
      this.guildId = data.source_guild_id;
    }
    if ('serialized_source_guild' in data) {
      this.serializedGuild = data.serialized_source_guild;
    }
    this.unSynced = 'is_dirty' in data ? Boolean(data.is_dirty) : null;
    return this;
  }
  async createGuild(name, icon) {
    const { client } = this;
    const data = await client.api.guilds.templates(this.code).post({
      data: {
        name,
        icon: await DataResolver.resolveImage(icon),
      },
    });
    if (client.guilds.cache.has(data.id)) return client.guilds.cache.get(data.id);
    return new Promise(resolve => {
      const resolveGuild = guild => {
        client.off(Events.GUILD_CREATE, handleGuild);
        client.decrementMaxListeners();
        resolve(guild);
      };
      const handleGuild = guild => {
        if (guild.id === data.id) {
          clearTimeout(timeout);
          resolveGuild(guild);
        }
      };
      client.incrementMaxListeners();
      client.on(Events.GUILD_CREATE, handleGuild);
      const timeout = setTimeout(() => resolveGuild(client.guilds._add(data)), 10_000).unref();
    });
  }
  async edit({ name, description } = {}) {
    const data = await this.client.api.guilds(this.guildId).templates(this.code).patch({ data: { name, description } });
    return this._patch(data);
  }
  async delete() {
    await this.client.api.guilds(this.guildId).templates(this.code).delete();
    return this;
  }
  async sync() {
    const data = await this.client.api.guilds(this.guildId).templates(this.code).put();
    return this._patch(data);
  }
  get createdTimestamp() {
    return this.createdAt.getTime();
  }
  get updatedTimestamp() {
    return this.updatedAt.getTime();
  }
  get guild() {
    return this.client.guilds.resolve(this.guildId);
  }
  get url() {
    return `${this.client.options.http.template}/${this.code}`;
  }
  toString() {
    return this.code;
  }
}
GuildTemplate.GUILD_TEMPLATES_PATTERN = /discord(?:app)?\.(?:com\/template|new)\/([\w-]{2,255})/gi;
module.exports = GuildTemplate;
