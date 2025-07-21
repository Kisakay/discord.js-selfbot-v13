'use strict';
const BaseGuildEmoji = require('./BaseGuildEmoji');
const { Error } = require('../errors');
const GuildEmojiRoleManager = require('../managers/GuildEmojiRoleManager');
const Permissions = require('../util/Permissions');
class GuildEmoji extends BaseGuildEmoji {
  constructor(client, data, guild) {
    super(client, data, guild);
    this.author = null;
    Object.defineProperty(this, '_roles', { value: [], writable: true });
    this._patch(data);
  }
  _clone() {
    const clone = super._clone();
    clone._roles = this._roles.slice();
    return clone;
  }
  _patch(data) {
    super._patch(data);
    if (data.user) this.author = this.client.users._add(data.user);
    if (data.roles) this._roles = data.roles;
  }
  get deletable() {
    if (!this.guild.members.me) throw new Error('GUILD_UNCACHED_ME');
    return !this.managed && this.guild.members.me.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS);
  }
  get roles() {
    return new GuildEmojiRoleManager(this);
  }
  fetchAuthor() {
    return this.guild.emojis.fetchAuthor(this);
  }
  async edit(data, reason) {
    const roles = data.roles?.map(r => r.id ?? r);
    const newData = await this.client.api
      .guilds(this.guild.id)
      .emojis(this.id)
      .patch({
        data: {
          name: data.name,
          roles,
        },
        reason,
      });
    const clone = this._clone();
    clone._patch(newData);
    return clone;
  }
  setName(name, reason) {
    return this.edit({ name }, reason);
  }
  async delete(reason) {
    await this.guild.emojis.delete(this, reason);
    return this;
  }
  equals(other) {
    if (other instanceof GuildEmoji) {
      return (
        other.id === this.id &&
        other.name === this.name &&
        other.managed === this.managed &&
        other.available === this.available &&
        other.requiresColons === this.requiresColons &&
        other.roles.cache.size === this.roles.cache.size &&
        other.roles.cache.every(role => this.roles.cache.has(role.id))
      );
    } else {
      return (
        other.id === this.id &&
        other.name === this.name &&
        other.roles.length === this.roles.cache.size &&
        other.roles.every(role => this.roles.cache.has(role))
      );
    }
  }
}
module.exports = GuildEmoji;
