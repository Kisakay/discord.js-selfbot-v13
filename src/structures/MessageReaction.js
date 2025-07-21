'use strict';
const GuildEmoji = require('./GuildEmoji');
const ReactionEmoji = require('./ReactionEmoji');
const ReactionUserManager = require('../managers/ReactionUserManager');
const Util = require('../util/Util');
class MessageReaction {
  constructor(client, data, message) {
    Object.defineProperty(this, 'client', { value: client });
    this.message = message;
    this.me = data.me;
    this.meBurst = Boolean(data.me_burst);
    this.users = new ReactionUserManager(this, this.me ? [client.user] : []);
    this._emoji = new ReactionEmoji(this, data.emoji);
    this.burstColors = null;
    this._patch(data);
  }
  _patch(data) {
    if (data.burst_colors) {
      this.burstColors = data.burst_colors;
    }
    if ('count' in data) {
      this.count ??= data.count;
    }
    if ('count_details' in data) {
      this.countDetails = {
        burst: data.count_details.burst,
        normal: data.count_details.normal,
      };
    } else {
      this.countDetails ??= { burst: 0, normal: 0 };
    }
  }
  async remove() {
    await this.client.api
      .channels(this.message.channelId)
      .messages(this.message.id)
      .reactions(this._emoji.identifier)
      .delete();
    return this;
  }
  get emoji() {
    if (this._emoji instanceof GuildEmoji) return this._emoji;
    if (this._emoji.id) {
      const emojis = this.message.client.emojis.cache;
      if (emojis.has(this._emoji.id)) {
        const emoji = emojis.get(this._emoji.id);
        this._emoji = emoji;
        return emoji;
      }
    }
    return this._emoji;
  }
  get partial() {
    return this.count === null;
  }
  async fetch() {
    const message = await this.message.fetch();
    const existing = message.reactions.cache.get(this.emoji.id ?? this.emoji.name);
    this._patch(existing ?? { count: 0 });
    return this;
  }
  toJSON() {
    return Util.flatten(this, { emoji: 'emojiId', message: 'messageId' });
  }
  _add(user, burst) {
    if (this.partial) return;
    this.users.cache.set(user.id, user);
    if (!this.me || user.id !== this.message.client.user.id || this.count === 0) {
      this.count++;
      if (burst) this.countDetails.burst++;
      else this.countDetails.normal++;
    }
    if (user.id === this.message.client.user.id) {
      if (burst) this.meBurst = true;
      else this.me = true;
    }
  }
  _remove(user, burst) {
    if (this.partial) return;
    this.users.cache.delete(user.id);
    if (!this.me || user.id !== this.message.client.user.id) {
      this.count--;
      if (burst) this.countDetails.burst--;
      else this.countDetails.normal--;
    }
    if (user.id === this.message.client.user.id) {
      if (burst) this.meBurst = false;
      else this.me = false;
    }
    if (this.count <= 0 && this.users.cache.size === 0) {
      this.message.reactions.cache.delete(this.emoji.id ?? this.emoji.name);
    }
  }
}
module.exports = MessageReaction;
