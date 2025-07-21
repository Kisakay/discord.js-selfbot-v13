'use strict';
const GuildChannel = require('./GuildChannel');
const TextBasedChannel = require('./interfaces/TextBasedChannel');
const GuildForumThreadManager = require('../managers/GuildForumThreadManager');
const { SortOrderTypes } = require('../util/Constants');
const { transformAPIGuildForumTag, transformAPIGuildDefaultReaction } = require('../util/Util');
class ThreadOnlyChannel extends GuildChannel {
  constructor(guild, data, client) {
    super(guild, data, client, false);
    this.threads = new GuildForumThreadManager(this);
    this._patch(data);
  }
  _patch(data) {
    super._patch(data);
    if ('available_tags' in data) {
      this.availableTags = data.available_tags.map(tag => transformAPIGuildForumTag(tag));
    } else {
      this.availableTags ??= [];
    }
    if ('default_reaction_emoji' in data) {
      this.defaultReactionEmoji =
        data.default_reaction_emoji && transformAPIGuildDefaultReaction(data.default_reaction_emoji);
    } else {
      this.defaultReactionEmoji ??= null;
    }
    if ('default_thread_rate_limit_per_user' in data) {
      this.defaultThreadRateLimitPerUser = data.default_thread_rate_limit_per_user;
    } else {
      this.defaultThreadRateLimitPerUser ??= null;
    }
    if ('rate_limit_per_user' in data) {
      this.rateLimitPerUser = data.rate_limit_per_user;
    } else {
      this.rateLimitPerUser ??= null;
    }
    if ('default_auto_archive_duration' in data) {
      this.defaultAutoArchiveDuration = data.default_auto_archive_duration;
    } else {
      this.defaultAutoArchiveDuration ??= null;
    }
    if ('nsfw' in data) {
      this.nsfw = data.nsfw;
    } else {
      this.nsfw ??= false;
    }
    if ('topic' in data) {
      this.topic = data.topic;
    }
    if ('default_sort_order' in data) {
      this.defaultSortOrder = SortOrderTypes[data.default_sort_order];
    } else {
      this.defaultSortOrder ??= null;
    }
  }
  setAvailableTags(availableTags, reason) {
    return this.edit({ availableTags }, reason);
  }
  setDefaultReactionEmoji(defaultReactionEmoji, reason) {
    return this.edit({ defaultReactionEmoji }, reason);
  }
  setDefaultThreadRateLimitPerUser(defaultThreadRateLimitPerUser, reason) {
    return this.edit({ defaultThreadRateLimitPerUser }, reason);
  }
  setDefaultSortOrder(defaultSortOrder, reason) {
    return this.edit({ defaultSortOrder }, reason);
  }
  createInvite(options) {
    return this.guild.invites.create(this.id, options);
  }
  fetchInvites(cache = true) {
    return this.guild.invites.fetch({ channelId: this.id, cache });
  }
  setDefaultAutoArchiveDuration(defaultAutoArchiveDuration, reason) {
    return this.edit({ defaultAutoArchiveDuration }, reason);
  }
  setTopic(topic, reason) {
    return this.edit({ topic }, reason);
  }
  createWebhook() {}
  fetchWebhooks() {}
  setNSFW() {}
  setRateLimitPerUser() {}
}
TextBasedChannel.applyToClass(ThreadOnlyChannel, true, [
  'send',
  'lastMessage',
  'lastPinAt',
  'bulkDelete',
  'sendTyping',
  'createMessageCollector',
  'awaitMessages',
  'createMessageComponentCollector',
  'awaitMessageComponent',
]);
module.exports = ThreadOnlyChannel;
