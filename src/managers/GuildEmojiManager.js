'use strict';
const { Collection } = require('@discordjs/collection');
const BaseGuildEmojiManager = require('./BaseGuildEmojiManager');
const { Error, TypeError } = require('../errors');
const DataResolver = require('../util/DataResolver');
const Permissions = require('../util/Permissions');
class GuildEmojiManager extends BaseGuildEmojiManager {
  constructor(guild, iterable) {
    super(guild.client, iterable);
    this.guild = guild;
  }
  _add(data, cache) {
    return super._add(data, cache, { extras: [this.guild] });
  }
  async create(attachment, name, { roles, reason } = {}) {
    attachment = await DataResolver.resolveImage(attachment);
    if (!attachment) throw new TypeError('REQ_RESOURCE_TYPE');
    const data = { image: attachment, name };
    if (roles) {
      if (!Array.isArray(roles) && !(roles instanceof Collection)) {
        throw new TypeError('INVALID_TYPE', 'options.roles', 'Array or Collection of Roles or Snowflakes', true);
      }
      data.roles = [];
      for (const role of roles.values()) {
        const resolvedRole = this.guild.roles.resolveId(role);
        if (!resolvedRole) throw new TypeError('INVALID_ELEMENT', 'Array or Collection', 'options.roles', role);
        data.roles.push(resolvedRole);
      }
    }
    const emoji = await this.client.api.guilds(this.guild.id).emojis.post({ data, reason });
    return this.client.actions.GuildEmojiCreate.handle(this.guild, emoji).emoji;
  }
  async fetch(id, { cache = true, force = false } = {}) {
    if (id) {
      if (!force) {
        const existing = this.cache.get(id);
        if (existing) return existing;
      }
      const emoji = await this.client.api.guilds(this.guild.id).emojis(id).get();
      return this._add(emoji, cache);
    }
    const data = await this.client.api.guilds(this.guild.id).emojis.get();
    const emojis = new Collection();
    for (const emoji of data) emojis.set(emoji.id, this._add(emoji, cache));
    return emojis;
  }
  async delete(emoji, reason) {
    const id = this.resolveId(emoji);
    if (!id) throw new TypeError('INVALID_TYPE', 'emoji', 'EmojiResolvable', true);
    await this.client.api.guilds(this.guild.id).emojis(id).delete({ reason });
  }
  async edit(emoji, data, reason) {
    const id = this.resolveId(emoji);
    if (!id) throw new TypeError('INVALID_TYPE', 'emoji', 'EmojiResolvable', true);
    const roles = data.roles?.map(r => this.guild.roles.resolveId(r));
    const newData = await this.client.api
      .guilds(this.guild.id)
      .emojis(id)
      .patch({
        data: {
          name: data.name,
          roles,
        },
        reason,
      });
    const existing = this.cache.get(id);
    if (existing) {
      const clone = existing._clone();
      clone._patch(newData);
      return clone;
    }
    return this._add(newData);
  }
  async fetchAuthor(emoji) {
    emoji = this.resolve(emoji);
    if (!emoji) throw new TypeError('INVALID_TYPE', 'emoji', 'EmojiResolvable', true);
    if (emoji.managed) {
      throw new Error('EMOJI_MANAGED');
    }
    const { me } = this.guild.members;
    if (!me) throw new Error('GUILD_UNCACHED_ME');
    if (!me.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS)) {
      throw new Error('MISSING_MANAGE_EMOJIS_AND_STICKERS_PERMISSION', this.guild);
    }
    const data = await this.client.api.guilds(this.guild.id).emojis(emoji.id).get();
    emoji._patch(data);
    return emoji.author;
  }
}
module.exports = GuildEmojiManager;
