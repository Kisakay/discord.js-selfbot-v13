'use strict';
const GuildChannel = require('./GuildChannel');
const TextBasedChannel = require('./interfaces/TextBasedChannel');
const GuildTextThreadManager = require('../managers/GuildTextThreadManager');
const MessageManager = require('../managers/MessageManager');
class BaseGuildTextChannel extends GuildChannel {
  constructor(guild, data, client) {
    super(guild, data, client, false);
    this.messages = new MessageManager(this);
    this.threads = new GuildTextThreadManager(this);
    this.nsfw = Boolean(data.nsfw);
    this._patch(data);
  }
  _patch(data) {
    super._patch(data);
    if ('topic' in data) {
      this.topic = data.topic;
    }
    if ('nsfw' in data) {
      this.nsfw = Boolean(data.nsfw);
    }
    if ('last_message_id' in data) {
      this.lastMessageId = data.last_message_id;
    }
    if ('last_pin_timestamp' in data) {
      this.lastPinTimestamp = data.last_pin_timestamp ? new Date(data.last_pin_timestamp).getTime() : null;
    }
    if ('default_auto_archive_duration' in data) {
      this.defaultAutoArchiveDuration = data.default_auto_archive_duration;
    }
    if ('default_thread_rate_limit_per_user' in data) {
      this.defaultThreadRateLimitPerUser = data.default_thread_rate_limit_per_user;
    } else {
      this.defaultThreadRateLimitPerUser ??= null;
    }
    if ('messages' in data) {
      for (const message of data.messages) this.messages._add(message);
    }
  }
  setDefaultAutoArchiveDuration(defaultAutoArchiveDuration, reason) {
    return this.edit({ defaultAutoArchiveDuration }, reason);
  }
  setType(type, reason) {
    return this.edit({ type }, reason);
  }
  setTopic(topic, reason) {
    return this.edit({ topic }, reason);
  }
  createInvite(options) {
    return this.guild.invites.create(this.id, options);
  }
  fetchInvites(cache = true) {
    return this.guild.invites.fetch({ channelId: this.id, cache });
  }
  get lastMessage() {}
  get lastPinAt() {}
  send() {}
  sendTyping() {}
  createMessageCollector() {}
  awaitMessages() {}
  fetchWebhooks() {}
  createWebhook() {}
  setRateLimitPerUser() {}
  setNSFW() {}
}
TextBasedChannel.applyToClass(BaseGuildTextChannel, true);
module.exports = BaseGuildTextChannel;
