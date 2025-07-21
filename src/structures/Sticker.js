'use strict';
const process = require('node:process');
const Base = require('./Base');
const { Error } = require('../errors');
const { StickerFormatTypes, StickerTypes } = require('../util/Constants');
const SnowflakeUtil = require('../util/SnowflakeUtil');
const deletedStickers = new WeakSet();
let deprecationEmittedForDeleted = false;
class Sticker extends Base {
  constructor(client, sticker) {
    super(client);
    this._patch(sticker);
  }
  _patch(sticker) {
    this.id = sticker.id;
    if ('description' in sticker) {
      this.description = sticker.description;
    } else {
      this.description ??= null;
    }
    if ('type' in sticker) {
      this.type = StickerTypes[sticker.type];
    } else {
      this.type ??= null;
    }
    if ('format_type' in sticker) {
      this.format = StickerFormatTypes[sticker.format_type];
    }
    if ('name' in sticker) {
      this.name = sticker.name;
    }
    if ('pack_id' in sticker) {
      this.packId = sticker.pack_id;
    } else {
      this.packId ??= null;
    }
    if ('tags' in sticker) {
      this.tags = sticker.tags.split(', ');
    } else {
      this.tags ??= null;
    }
    if ('available' in sticker) {
      this.available = sticker.available;
    } else {
      this.available ??= null;
    }
    if ('guild_id' in sticker) {
      this.guildId = sticker.guild_id;
    } else {
      this.guildId ??= null;
    }
    if ('user' in sticker) {
      this.user = this.client.users._add(sticker.user);
    } else {
      this.user ??= null;
    }
    if ('sort_value' in sticker) {
      this.sortValue = sticker.sort_value;
    } else {
      this.sortValue ??= null;
    }
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  get deleted() {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Sticker#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedStickers.has(this);
  }
  set deleted(value) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Sticker#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedStickers.add(this);
    else deletedStickers.delete(this);
  }
  get partial() {
    return !this.type;
  }
  get guild() {
    return this.client.guilds.resolve(this.guildId);
  }
  get url() {
    return this.client.rest.cdn.Sticker(this.id, this.format);
  }
  async fetch() {
    const data = await this.client.api.stickers(this.id).get();
    this._patch(data);
    return this;
  }
  async fetchPack() {
    return (this.packId && (await this.client.fetchPremiumStickerPacks()).get(this.packId)) ?? null;
  }
  async fetchUser() {
    if (this.partial) await this.fetch();
    if (!this.guildId) throw new Error('NOT_GUILD_STICKER');
    return this.guild.stickers.fetchUser(this);
  }
  edit(data, reason) {
    return this.guild.stickers.edit(this, data, reason);
  }
  async delete(reason) {
    await this.guild.stickers.delete(this, reason);
    return this;
  }
  equals(other) {
    if (other instanceof Sticker) {
      return (
        other.id === this.id &&
        other.description === this.description &&
        other.type === this.type &&
        other.format === this.format &&
        other.name === this.name &&
        other.packId === this.packId &&
        other.tags.length === this.tags.length &&
        other.tags.every(tag => this.tags.includes(tag)) &&
        other.available === this.available &&
        other.guildId === this.guildId &&
        other.sortValue === this.sortValue
      );
    } else {
      return (
        other.id === this.id &&
        other.description === this.description &&
        other.name === this.name &&
        other.tags === this.tags.join(', ')
      );
    }
  }
}
exports.Sticker = Sticker;
exports.deletedStickers = deletedStickers;
