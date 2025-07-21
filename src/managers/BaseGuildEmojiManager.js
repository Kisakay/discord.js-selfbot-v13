'use strict';
const CachedManager = require('./CachedManager');
const GuildEmoji = require('../structures/GuildEmoji');
const ReactionEmoji = require('../structures/ReactionEmoji');
const { parseEmoji } = require('../util/Util');
class BaseGuildEmojiManager extends CachedManager {
  constructor(client, iterable) {
    super(client, GuildEmoji, iterable);
  }
  resolve(emoji) {
    if (emoji instanceof ReactionEmoji) return this.cache.get(emoji.id) ?? null;
    return super.resolve(emoji);
  }
  resolveId(emoji) {
    if (emoji instanceof ReactionEmoji) return emoji.id;
    return super.resolveId(emoji);
  }
  resolveIdentifier(emoji) {
    const emojiResolvable = this.resolve(emoji);
    if (emojiResolvable) return emojiResolvable.identifier;
    if (emoji instanceof ReactionEmoji) return emoji.identifier;
    if (typeof emoji === 'string') {
      const res = parseEmoji(emoji);
      if (res?.name.length) {
        emoji = `${res.animated ? 'a:' : ''}${res.name}${res.id ? `:${res.id}` : ''}`;
      }
      if (!emoji.includes('%')) return encodeURIComponent(emoji);
      return emoji;
    }
    return null;
  }
}
module.exports = BaseGuildEmojiManager;
