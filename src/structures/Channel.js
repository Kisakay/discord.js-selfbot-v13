'use strict';
const process = require('node:process');
const Base = require('./Base');
let CategoryChannel;
let DMChannel;
let NewsChannel;
let StageChannel;
let StoreChannel;
let TextChannel;
let ThreadChannel;
let DirectoryChannel;
let ForumChannel;
let MediaChannel;
const ChannelFlags = require('../util/ChannelFlags');
const { ChannelTypes, ThreadChannelTypes, VoiceBasedChannelTypes } = require('../util/Constants');
const SnowflakeUtil = require('../util/SnowflakeUtil');
const deletedChannels = new WeakSet();
let deprecationEmittedForDeleted = false;
class Channel extends Base {
  constructor(client, data, immediatePatch = true) {
    super(client);
    const type = ChannelTypes[data?.type];
    this.type = type ?? 'UNKNOWN';
    if (data && immediatePatch) this._patch(data);
  }
  _patch(data) {
    this.id = data.id;
    if ('flags' in data) {
      this.flags = new ChannelFlags(data.flags).freeze();
    } else {
      this.flags ??= new ChannelFlags().freeze();
    }
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  get deleted() {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Channel#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedChannels.has(this);
  }
  set deleted(value) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Channel#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedChannels.add(this);
    else deletedChannels.delete(this);
  }
  get partial() {
    return false;
  }
  toString() {
    return `<#${this.id}>`;
  }
  async delete() {
    await this.client.api.channels(this.id).delete();
    return this;
  }
  fetch(force = true) {
    return this.client.channels.fetch(this.id, { force });
  }
  isText() {
    return 'messages' in this;
  }
  isVoice() {
    return VoiceBasedChannelTypes.includes(this.type);
  }
  isThread() {
    return ThreadChannelTypes.includes(this.type);
  }
  isThreadOnly() {
    return 'availableTags' in this;
  }
  isDirectory() {
    return this.type === 'GUILD_DIRECTORY';
  }
  static create(client, data, guild, { allowUnknownGuild } = {}) {
    CategoryChannel ??= require('./CategoryChannel');
    DMChannel ??= require('./DMChannel');
    NewsChannel ??= require('./NewsChannel');
    StoreChannel ??= require('./StoreChannel');
    TextChannel ??= require('./TextChannel');
    ThreadChannel ??= require('./ThreadChannel');
    DirectoryChannel ??= require('./DirectoryChannel');
    ForumChannel ??= require('./ForumChannel');
    MediaChannel ??= require('./MediaChannel');
    let channel;
    if (!data.guild_id && !guild) {
      if ((data.recipients && data.type !== ChannelTypes.GROUP_DM) || data.type === ChannelTypes.DM) {
        channel = new DMChannel(client, data);
      } else if (data.type === ChannelTypes.GROUP_DM) {
        const GroupDMChannel = require('./GroupDMChannel');
        channel = new GroupDMChannel(client, data);
      }
    } else {
      guild ??= client.guilds.cache.get(data.guild_id);
      if (guild || allowUnknownGuild) {
        switch (data.type) {
          case ChannelTypes.GUILD_TEXT: {
            channel = new TextChannel(guild, data, client);
            break;
          }
          case ChannelTypes.GUILD_CATEGORY: {
            channel = new CategoryChannel(guild, data, client);
            break;
          }
          case ChannelTypes.GUILD_NEWS: {
            channel = new NewsChannel(guild, data, client);
            break;
          }
          case ChannelTypes.GUILD_STORE: {
            channel = new StoreChannel(guild, data, client);
            break;
          }
          case ChannelTypes.GUILD_NEWS_THREAD:
          case ChannelTypes.GUILD_PUBLIC_THREAD:
          case ChannelTypes.GUILD_PRIVATE_THREAD: {
            channel = new ThreadChannel(guild, data, client);
            if (!allowUnknownGuild) channel.parent?.threads.cache.set(channel.id, channel);
            break;
          }
          case ChannelTypes.GUILD_DIRECTORY:
            channel = new DirectoryChannel(client, data);
            break;
          case ChannelTypes.GUILD_FORUM:
            channel = new ForumChannel(guild, data, client);
            break;
          case ChannelTypes.GUILD_MEDIA:
            channel = new MediaChannel(guild, data, client);
            break;
        }
        if (channel && !allowUnknownGuild) guild.channels?.cache.set(channel.id, channel);
      }
    }
    return channel;
  }
  toJSON(...props) {
    return super.toJSON({ createdTimestamp: true }, ...props);
  }
}
exports.Channel = Channel;
exports.deletedChannels = deletedChannels;
