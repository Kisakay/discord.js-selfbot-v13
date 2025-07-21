'use strict';
const { Collection } = require('@discordjs/collection');
const Base = require('./Base');
const GuildPreviewEmoji = require('./GuildPreviewEmoji');
const { Sticker } = require('./Sticker');
const SnowflakeUtil = require('../util/SnowflakeUtil');
class GuildPreview extends Base {
  constructor(client, data) {
    super(client);
    if (!data) return;
    this._patch(data);
  }
  _patch(data) {
    this.id = data.id;
    if ('name' in data) {
      this.name = data.name;
    }
    if ('icon' in data) {
      this.icon = data.icon;
    }
    if ('splash' in data) {
      this.splash = data.splash;
    }
    if ('discovery_splash' in data) {
      this.discoverySplash = data.discovery_splash;
    }
    if ('features' in data) {
      this.features = data.features;
    }
    if ('approximate_member_count' in data) {
      this.approximateMemberCount = data.approximate_member_count;
    }
    if ('approximate_presence_count' in data) {
      this.approximatePresenceCount = data.approximate_presence_count;
    }
    if ('description' in data) {
      this.description = data.description;
    } else {
      this.description ??= null;
    }
    if (!this.emojis) {
      this.emojis = new Collection();
    } else {
      this.emojis.clear();
    }
    for (const emoji of data.emojis) {
      this.emojis.set(emoji.id, new GuildPreviewEmoji(this.client, emoji, this));
    }
    this.stickers = data.stickers.reduce(
      (stickers, sticker) => stickers.set(sticker.id, new Sticker(this.client, sticker)),
      new Collection(),
    );
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  splashURL({ format, size } = {}) {
    return this.splash && this.client.rest.cdn.Splash(this.id, this.splash, format, size);
  }
  discoverySplashURL({ format, size } = {}) {
    return this.discoverySplash && this.client.rest.cdn.DiscoverySplash(this.id, this.discoverySplash, format, size);
  }
  iconURL({ format, size, dynamic } = {}) {
    return this.icon && this.client.rest.cdn.Icon(this.id, this.icon, format, size, dynamic);
  }
  async fetch() {
    const data = await this.client.api.guilds(this.id).preview.get();
    this._patch(data);
    return this;
  }
  toString() {
    return this.name;
  }
  toJSON() {
    const json = super.toJSON();
    json.iconURL = this.iconURL();
    json.splashURL = this.splashURL();
    return json;
  }
}
module.exports = GuildPreview;
