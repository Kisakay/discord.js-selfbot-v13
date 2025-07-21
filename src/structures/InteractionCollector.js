'use strict';
const { Collection } = require('@discordjs/collection');
const Collector = require('./interfaces/Collector');
const { Events } = require('../util/Constants');
const { InteractionTypes, MessageComponentTypes } = require('../util/Constants');
class InteractionCollector extends Collector {
  constructor(client, options = {}) {
    super(client, options);
    this.messageId = options.message?.id ?? null;
    this.channelId =
      this.client.channels.resolveId(options.message?.channel) ??
      options.message?.channel_id ??
      this.client.channels.resolveId(options.channel);
    this.guildId =
      this.client.guilds.resolveId(options.message?.guild) ??
      options.message?.guild_id ??
      this.client.guilds.resolveId(options.channel?.guild) ??
      this.client.guilds.resolveId(options.guild);
    this.interactionType =
      typeof options.interactionType === 'number'
        ? InteractionTypes[options.interactionType]
        : (options.interactionType ?? null);
    this.componentType =
      typeof options.componentType === 'number'
        ? MessageComponentTypes[options.componentType]
        : (options.componentType ?? null);
    this.users = new Collection();
    this.total = 0;
    this.empty = this.empty.bind(this);
    this.client.incrementMaxListeners();
    const bulkDeleteListener = messages => {
      if (messages.has(this.messageId)) this.stop('messageDelete');
    };
    if (this.messageId) {
      this._handleMessageDeletion = this._handleMessageDeletion.bind(this);
      this.client.on(Events.MESSAGE_DELETE, this._handleMessageDeletion);
      this.client.on(Events.MESSAGE_BULK_DELETE, bulkDeleteListener);
    }
    if (this.channelId) {
      this._handleChannelDeletion = this._handleChannelDeletion.bind(this);
      this._handleThreadDeletion = this._handleThreadDeletion.bind(this);
      this.client.on(Events.CHANNEL_DELETE, this._handleChannelDeletion);
      this.client.on(Events.THREAD_DELETE, this._handleThreadDeletion);
    }
    if (this.guildId) {
      this._handleGuildDeletion = this._handleGuildDeletion.bind(this);
      this.client.on(Events.GUILD_DELETE, this._handleGuildDeletion);
    }
    this.client.on(Events.INTERACTION_CREATE, this.handleCollect);
    this.once('end', () => {
      this.client.removeListener(Events.INTERACTION_CREATE, this.handleCollect);
      this.client.removeListener(Events.MESSAGE_DELETE, this._handleMessageDeletion);
      this.client.removeListener(Events.MESSAGE_BULK_DELETE, bulkDeleteListener);
      this.client.removeListener(Events.CHANNEL_DELETE, this._handleChannelDeletion);
      this.client.removeListener(Events.THREAD_DELETE, this._handleThreadDeletion);
      this.client.removeListener(Events.GUILD_DELETE, this._handleGuildDeletion);
      this.client.decrementMaxListeners();
    });
    this.on('collect', interaction => {
      this.total++;
      this.users.set(interaction.user.id, interaction.user);
    });
  }
  collect(interaction) {
    if (this.interactionType && interaction.type !== this.interactionType) return null;
    if (this.componentType && interaction.componentType !== this.componentType) return null;
    if (this.messageId && interaction.message?.id !== this.messageId) return null;
    if (this.channelId && interaction.channelId !== this.channelId) return null;
    if (this.guildId && interaction.guildId !== this.guildId) return null;
    return interaction.id;
  }
  dispose(interaction) {
    if (this.type && interaction.type !== this.type) return null;
    if (this.componentType && interaction.componentType !== this.componentType) return null;
    if (this.messageId && interaction.message?.id !== this.messageId) return null;
    if (this.channelId && interaction.channelId !== this.channelId) return null;
    if (this.guildId && interaction.guildId !== this.guildId) return null;
    return interaction.id;
  }
  empty() {
    this.total = 0;
    this.collected.clear();
    this.users.clear();
    this.checkEnd();
  }
  get endReason() {
    if (this.options.max && this.total >= this.options.max) return 'limit';
    if (this.options.maxComponents && this.collected.size >= this.options.maxComponents) return 'componentLimit';
    if (this.options.maxUsers && this.users.size >= this.options.maxUsers) return 'userLimit';
    return null;
  }
  _handleMessageDeletion(message) {
    if (message.id === this.messageId) {
      this.stop('messageDelete');
    }
  }
  _handleChannelDeletion(channel) {
    if (channel.id === this.channelId || channel.threads?.cache.has(this.channelId)) {
      this.stop('channelDelete');
    }
  }
  _handleThreadDeletion(thread) {
    if (thread.id === this.channelId) {
      this.stop('threadDelete');
    }
  }
  _handleGuildDeletion(guild) {
    if (guild.id === this.guildId) {
      this.stop('guildDelete');
    }
  }
}
module.exports = InteractionCollector;
