'use strict';
const Collector = require('./interfaces/Collector');
const { Events } = require('../util/Constants');
class MessageCollector extends Collector {
  constructor(channel, options = {}) {
    super(channel.client, options);
    this.channel = channel;
    this.received = 0;
    const bulkDeleteListener = messages => {
      for (const message of messages.values()) this.handleDispose(message);
    };
    this._handleChannelDeletion = this._handleChannelDeletion.bind(this);
    this._handleThreadDeletion = this._handleThreadDeletion.bind(this);
    this._handleGuildDeletion = this._handleGuildDeletion.bind(this);
    this.client.incrementMaxListeners();
    this.client.on(Events.MESSAGE_CREATE, this.handleCollect);
    this.client.on(Events.MESSAGE_DELETE, this.handleDispose);
    this.client.on(Events.MESSAGE_BULK_DELETE, bulkDeleteListener);
    this.client.on(Events.CHANNEL_DELETE, this._handleChannelDeletion);
    this.client.on(Events.THREAD_DELETE, this._handleThreadDeletion);
    this.client.on(Events.GUILD_DELETE, this._handleGuildDeletion);
    this.once('end', () => {
      this.client.removeListener(Events.MESSAGE_CREATE, this.handleCollect);
      this.client.removeListener(Events.MESSAGE_DELETE, this.handleDispose);
      this.client.removeListener(Events.MESSAGE_BULK_DELETE, bulkDeleteListener);
      this.client.removeListener(Events.CHANNEL_DELETE, this._handleChannelDeletion);
      this.client.removeListener(Events.THREAD_DELETE, this._handleThreadDeletion);
      this.client.removeListener(Events.GUILD_DELETE, this._handleGuildDeletion);
      this.client.decrementMaxListeners();
    });
  }
  collect(message) {
    if (message.channelId !== this.channel.id) return null;
    this.received++;
    return message.id;
  }
  dispose(message) {
    return message.channelId === this.channel.id ? message.id : null;
  }
  get endReason() {
    if (this.options.max && this.collected.size >= this.options.max) return 'limit';
    if (this.options.maxProcessed && this.received === this.options.maxProcessed) return 'processedLimit';
    return null;
  }
  _handleChannelDeletion(channel) {
    if (channel.id === this.channel.id || channel.id === this.channel.parentId) {
      this.stop('channelDelete');
    }
  }
  _handleThreadDeletion(thread) {
    if (thread.id === this.channel.id) {
      this.stop('threadDelete');
    }
  }
  _handleGuildDeletion(guild) {
    if (guild.id === this.channel.guild?.id) {
      this.stop('guildDelete');
    }
  }
}
module.exports = MessageCollector;
