'use strict';
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { TypeError } = require('../errors');
const MessagePayload = require('../structures/MessagePayload');
const { Sticker } = require('../structures/Sticker');
class GuildStickerManager extends CachedManager {
  constructor(guild, iterable) {
    super(guild.client, Sticker, iterable);
    this.guild = guild;
  }
  _add(data, cache) {
    return super._add(data, cache, { extras: [this.guild] });
  }
  async create(file, name, tags, { description, reason } = {}) {
    const resolvedFile = await MessagePayload.resolveFile(file);
    if (!resolvedFile) throw new TypeError('REQ_RESOURCE_TYPE');
    file = { ...resolvedFile, key: 'file' };
    const data = { name, tags, description: description ?? '' };
    const sticker = await this.client.api
      .guilds(this.guild.id)
      .stickers.post({ data, files: [file], reason, dontUsePayloadJSON: true });
    return this.client.actions.GuildStickerCreate.handle(this.guild, sticker).sticker;
  }
  async edit(sticker, data, reason) {
    const stickerId = this.resolveId(sticker);
    if (!stickerId) throw new TypeError('INVALID_TYPE', 'sticker', 'StickerResolvable');
    const d = await this.client.api.guilds(this.guild.id).stickers(stickerId).patch({
      data,
      reason,
    });
    const existing = this.cache.get(stickerId);
    if (existing) {
      const clone = existing._clone();
      clone._patch(d);
      return clone;
    }
    return this._add(d);
  }
  async delete(sticker, reason) {
    sticker = this.resolveId(sticker);
    if (!sticker) throw new TypeError('INVALID_TYPE', 'sticker', 'StickerResolvable');
    await this.client.api.guilds(this.guild.id).stickers(sticker).delete({ reason });
  }
  async fetch(id, { cache = true, force = false } = {}) {
    if (id) {
      if (!force) {
        const existing = this.cache.get(id);
        if (existing) return existing;
      }
      const sticker = await this.client.api.guilds(this.guild.id).stickers(id).get();
      return this._add(sticker, cache);
    }
    const data = await this.client.api.guilds(this.guild.id).stickers.get();
    return new Collection(data.map(sticker => [sticker.id, this._add(sticker, cache)]));
  }
  async fetchUser(sticker) {
    sticker = this.resolve(sticker);
    if (!sticker) throw new TypeError('INVALID_TYPE', 'sticker', 'StickerResolvable');
    const data = await this.client.api.guilds(this.guild.id).stickers(sticker.id).get();
    sticker._patch(data);
    return sticker.user;
  }
}
module.exports = GuildStickerManager;
