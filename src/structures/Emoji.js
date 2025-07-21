'use strict';
const process = require('node:process');
const Base = require('./Base');
const SnowflakeUtil = require('../util/SnowflakeUtil');
const deletedEmojis = new WeakSet();
let deprecationEmittedForDeleted = false;
class Emoji extends Base {
  constructor(client, emoji) {
    super(client);
    this.animated = emoji.animated ?? null;
    this.name = emoji.name ?? null;
    this.id = emoji.id ?? null;
  }
  get deleted() {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Emoji#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedEmojis.has(this);
  }
  set deleted(value) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Emoji#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedEmojis.add(this);
    else deletedEmojis.delete(this);
  }
  get identifier() {
    if (this.id) return `${this.animated ? 'a:' : ''}${this.name}:${this.id}`;
    return encodeURIComponent(this.name);
  }
  get url() {
    return this.id && this.client.rest.cdn.Emoji(this.id, this.animated ? 'gif' : 'png');
  }
  get createdTimestamp() {
    return this.id && SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return this.id && new Date(this.createdTimestamp);
  }
  toString() {
    return this.id ? `<${this.animated ? 'a' : ''}:${this.name}:${this.id}>` : this.name;
  }
  toJSON() {
    return super.toJSON({
      guild: 'guildId',
      createdTimestamp: true,
      url: true,
      identifier: true,
    });
  }
}
exports.Emoji = Emoji;
exports.deletedEmojis = deletedEmojis;
