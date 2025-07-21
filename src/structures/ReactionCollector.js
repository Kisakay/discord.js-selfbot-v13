'use strict';
const { Collection } = require('@discordjs/collection');
const Collector = require('./interfaces/Collector');
const { Events } = require('../util/Constants');
class ReactionCollector extends Collector {
  constructor(message, options = {}) {
    super(message.client, options);
    this.message = message;
    this.users = new Collection();
    this.total = 0;
    this.empty = this.empty.bind(this);
    this._handleChannelDeletion = this._handleChannelDeletion.bind(this);
    this._handleThreadDeletion = this._handleThreadDeletion.bind(this);
    this._handleGuildDeletion = this._handleGuildDeletion.bind(this);
    this._handleMessageDeletion = this._handleMessageDeletion.bind(this);
    const bulkDeleteListener = messages => {
      if (messages.has(this.message.id)) this.stop('messageDelete');
    };
    this.client.incrementMaxListeners();
    this.client.on(Events.MESSAGE_REACTION_ADD, this.handleCollect);
    this.client.on(Events.MESSAGE_REACTION_REMOVE, this.handleDispose);
    this.client.on(Events.MESSAGE_REACTION_REMOVE_ALL, this.empty);
    this.client.on(Events.MESSAGE_DELETE, this._handleMessageDeletion);
    this.client.on(Events.MESSAGE_BULK_DELETE, bulkDeleteListener);
    this.client.on(Events.CHANNEL_DELETE, this._handleChannelDeletion);
    this.client.on(Events.THREAD_DELETE, this._handleThreadDeletion);
    this.client.on(Events.GUILD_DELETE, this._handleGuildDeletion);
    this.once('end', () => {
      this.client.removeListener(Events.MESSAGE_REACTION_ADD, this.handleCollect);
      this.client.removeListener(Events.MESSAGE_REACTION_REMOVE, this.handleDispose);
      this.client.removeListener(Events.MESSAGE_REACTION_REMOVE_ALL, this.empty);
      this.client.removeListener(Events.MESSAGE_DELETE, this._handleMessageDeletion);
      this.client.removeListener(Events.MESSAGE_BULK_DELETE, bulkDeleteListener);
      this.client.removeListener(Events.CHANNEL_DELETE, this._handleChannelDeletion);
      this.client.removeListener(Events.THREAD_DELETE, this._handleThreadDeletion);
      this.client.removeListener(Events.GUILD_DELETE, this._handleGuildDeletion);
      this.client.decrementMaxListeners();
    });
    this.on('collect', (reaction, user) => {
      if (reaction.count === 1) {
        this.emit('create', reaction, user);
      }
      this.total++;
      this.users.set(user.id, user);
    });
    this.on('remove', (reaction, user) => {
      this.total--;
      if (!this.collected.some(r => r.users.cache.has(user.id))) this.users.delete(user.id);
    });
  }
  collect(reaction) {
    if (reaction.message.id !== this.message.id) return null;
    return ReactionCollector.key(reaction);
  }
  dispose(reaction, user) {
    if (reaction.message.id !== this.message.id) return null;
    if (this.collected.has(ReactionCollector.key(reaction)) && this.users.has(user.id)) {
      this.emit('remove', reaction, user);
    }
    return reaction.count ? null : ReactionCollector.key(reaction);
  }
  empty() {
    this.total = 0;
    this.collected.clear();
    this.users.clear();
    this.checkEnd();
  }
  get endReason() {
    if (this.options.max && this.total >= this.options.max) return 'limit';
    if (this.options.maxEmojis && this.collected.size >= this.options.maxEmojis) return 'emojiLimit';
    if (this.options.maxUsers && this.users.size >= this.options.maxUsers) return 'userLimit';
    return null;
  }
  _handleMessageDeletion(message) {
    if (message.id === this.message.id) {
      this.stop('messageDelete');
    }
  }
  _handleChannelDeletion(channel) {
    if (channel.id === this.message.channelId || channel.threads?.cache.has(this.message.channelId)) {
      this.stop('channelDelete');
    }
  }
  _handleThreadDeletion(thread) {
    if (thread.id === this.message.channelId) {
      this.stop('threadDelete');
    }
  }
  _handleGuildDeletion(guild) {
    if (guild.id === this.message.guild?.id) {
      this.stop('guildDelete');
    }
  }
  static key(reaction) {
    return reaction.emoji.id ?? reaction.emoji.name;
  }
}
module.exports = ReactionCollector;
