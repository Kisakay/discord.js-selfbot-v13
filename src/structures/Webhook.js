'use strict';
const process = require('node:process');
const MessagePayload = require('./MessagePayload');
const { Error } = require('../errors');
const { WebhookTypes } = require('../util/Constants');
const DataResolver = require('../util/DataResolver');
const SnowflakeUtil = require('../util/SnowflakeUtil');
let deprecationEmittedForFetchMessage = false;
class Webhook {
  constructor(client, data) {
    Object.defineProperty(this, 'client', { value: client });
    if (data) this._patch(data);
  }
  _patch(data) {
    if ('name' in data) {
      this.name = data.name;
    }
    Object.defineProperty(this, 'token', { value: data.token ?? null, writable: true, configurable: true });
    if ('avatar' in data) {
      this.avatar = data.avatar;
    }
    this.id = data.id;
    if ('type' in data) {
      this.type = WebhookTypes[data.type];
    }
    if ('guild_id' in data) {
      this.guildId = data.guild_id;
    }
    if ('channel_id' in data) {
      this.channelId = data.channel_id;
    }
    if ('user' in data) {
      this.owner = this.client.users?._add(data.user) ?? data.user;
    } else {
      this.owner ??= null;
    }
    if ('source_guild' in data) {
      this.sourceGuild = this.client.guilds?.cache.get(data.source_guild.id) ?? data.source_guild;
    } else {
      this.sourceGuild ??= null;
    }
    if ('source_channel' in data) {
      this.sourceChannel = this.client.channels?.cache.get(data.source_channel?.id) ?? data.source_channel;
    } else {
      this.sourceChannel ??= null;
    }
  }
  async send(options) {
    if (!this.token) throw new Error('WEBHOOK_TOKEN_UNAVAILABLE');
    let messagePayload;
    if (options instanceof MessagePayload) {
      messagePayload = options.resolveData();
    } else {
      messagePayload = MessagePayload.create(this, options).resolveData();
    }
    const { data, files } = await messagePayload.resolveFiles();
    const d = await this.client.api.webhooks(this.id, this.token).post({
      data,
      files,
      query: { thread_id: messagePayload.options.threadId, wait: true },
      auth: false,
      webhook: true,
    });
    return this.client.channels?.cache.get(d.channel_id)?.messages._add(d, false) ?? d;
  }
  async sendSlackMessage(body) {
    if (!this.token) throw new Error('WEBHOOK_TOKEN_UNAVAILABLE');
    const data = await this.client.api.webhooks(this.id, this.token).slack.post({
      query: { wait: true },
      auth: false,
      data: body,
      webhook: true,
    });
    return data.toString() === 'ok';
  }
  async edit({ name = this.name, avatar, channel }, reason) {
    if (avatar && !(typeof avatar === 'string' && avatar.startsWith('data:'))) {
      avatar = await DataResolver.resolveImage(avatar);
    }
    channel &&= channel.id ?? channel;
    const data = await this.client.api.webhooks(this.id, channel ? undefined : this.token).patch({
      data: { name, avatar, channel_id: channel },
      reason,
      auth: !this.token || Boolean(channel),
      webhook: true,
    });
    this.name = data.name;
    this.avatar = data.avatar;
    this.channelId = data.channel_id;
    return this;
  }
  async fetchMessage(message, cacheOrOptions = { cache: true }) {
    if (typeof cacheOrOptions === 'boolean') {
      if (!deprecationEmittedForFetchMessage) {
        process.emitWarning(
          'Passing a boolean to cache the message in Webhook#fetchMessage is deprecated. Pass an object instead.',
          'DeprecationWarning',
        );
        deprecationEmittedForFetchMessage = true;
      }
      cacheOrOptions = { cache: cacheOrOptions };
    }
    if (!this.token) throw new Error('WEBHOOK_TOKEN_UNAVAILABLE');
    const data = await this.client.api
      .webhooks(this.id, this.token)
      .messages(message)
      .get({
        query: {
          thread_id: cacheOrOptions.threadId,
        },
        auth: false,
        webhook: true,
      });
    return this.client.channels?.cache.get(data.channel_id)?.messages._add(data, cacheOrOptions.cache) ?? data;
  }
  async editMessage(message, options) {
    if (!this.token) throw new Error('WEBHOOK_TOKEN_UNAVAILABLE');
    let messagePayload;
    if (options instanceof MessagePayload) messagePayload = options;
    else messagePayload = MessagePayload.create(this, options);
    const { data, files } = await messagePayload.resolveData().resolveFiles();
    const d = await this.client.api
      .webhooks(this.id, this.token)
      .messages(typeof message === 'string' ? message : message.id)
      .patch({
        data,
        files,
        query: {
          thread_id: messagePayload.options.threadId,
        },
        auth: false,
        webhook: true,
      });
    const messageManager = this.client.channels?.cache.get(d.channel_id)?.messages;
    if (!messageManager) return d;
    const existing = messageManager.cache.get(d.id);
    if (!existing) return messageManager._add(d);
    const clone = existing._clone();
    clone._patch(d);
    return clone;
  }
  async delete(reason) {
    await this.client.api.webhooks(this.id, this.token).delete({ reason, auth: !this.token, webhook: true });
  }
  async deleteMessage(message, threadId) {
    if (!this.token) throw new Error('WEBHOOK_TOKEN_UNAVAILABLE');
    await this.client.api
      .webhooks(this.id, this.token)
      .messages(typeof message === 'string' ? message : message.id)
      .delete({
        query: {
          thread_id: threadId,
        },
        auth: false,
        webhook: true,
      });
  }
  get channel() {
    return this.client.channels.resolve(this.channelId);
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  get url() {
    return this.client.options.http.api + this.client.api.webhooks(this.id, this.token);
  }
  avatarURL({ format, size } = {}) {
    if (!this.avatar) return null;
    return this.client.rest.cdn.Avatar(this.id, this.avatar, format, size);
  }
  isChannelFollower() {
    return this.type === 'Channel Follower';
  }
  isIncoming() {
    return this.type === 'Incoming';
  }
  static applyToClass(structure, ignore = []) {
    for (const prop of [
      'send',
      'sendSlackMessage',
      'fetchMessage',
      'edit',
      'editMessage',
      'delete',
      'deleteMessage',
      'createdTimestamp',
      'createdAt',
      'url',
    ]) {
      if (ignore.includes(prop)) continue;
      Object.defineProperty(structure.prototype, prop, Object.getOwnPropertyDescriptor(Webhook.prototype, prop));
    }
  }
}
module.exports = Webhook;
