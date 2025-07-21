'use strict';
const process = require('node:process');
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { Error, TypeError } = require('../errors');
const GuildChannel = require('../structures/GuildChannel');
const PermissionOverwrites = require('../structures/PermissionOverwrites');
const ThreadChannel = require('../structures/ThreadChannel');
const Webhook = require('../structures/Webhook');
const ChannelFlags = require('../util/ChannelFlags');
const {
  ThreadChannelTypes,
  ChannelTypes,
  VideoQualityModes,
  SortOrderTypes,
  ForumLayoutTypes,
} = require('../util/Constants');
const DataResolver = require('../util/DataResolver');
const Util = require('../util/Util');
const { resolveAutoArchiveMaxLimit, transformGuildForumTag, transformGuildDefaultReaction } = require('../util/Util');
let cacheWarningEmitted = false;
let storeChannelDeprecationEmitted = false;
class GuildChannelManager extends CachedManager {
  constructor(guild, iterable) {
    super(guild.client, GuildChannel, iterable);
    const defaultCaching =
      this._cache.constructor.name === 'Collection' ||
      ((this._cache.maxSize === undefined || this._cache.maxSize === Infinity) &&
        (this._cache.sweepFilter === undefined || this._cache.sweepFilter.isDefault));
    if (!cacheWarningEmitted && !defaultCaching) {
      cacheWarningEmitted = true;
      process.emitWarning(
        `Overriding the cache handling for ${this.constructor.name} is unsupported and breaks functionality.`,
        'UnsupportedCacheOverwriteWarning',
      );
    }
    this.guild = guild;
  }
  get channelCountWithoutThreads() {
    return this.cache.reduce((acc, channel) => {
      if (ThreadChannelTypes.includes(channel.type)) return acc;
      return ++acc;
    }, 0);
  }
  _add(channel) {
    const existing = this.cache.get(channel.id);
    if (existing) return existing;
    this.cache.set(channel.id, channel);
    return channel;
  }
  resolve(channel) {
    if (channel instanceof ThreadChannel) return this.cache.get(channel.id) ?? null;
    return super.resolve(channel);
  }
  resolveId(channel) {
    if (channel instanceof ThreadChannel) return super.resolveId(channel.id);
    return super.resolveId(channel);
  }
  async create(
    name,
    {
      type,
      topic,
      nsfw,
      bitrate,
      userLimit,
      parent,
      permissionOverwrites,
      position,
      rateLimitPerUser,
      rtcRegion,
      videoQualityMode,
      availableTags,
      defaultReactionEmoji,
      defaultSortOrder,
      defaultForumLayout,
      defaultThreadRateLimitPerUser,
      reason,
    } = {},
  ) {
    parent &&= this.client.channels.resolveId(parent);
    permissionOverwrites &&= permissionOverwrites.map(o => PermissionOverwrites.resolve(o, this.guild));
    const intType = typeof type === 'number' ? type : (ChannelTypes[type] ?? ChannelTypes.GUILD_TEXT);
    const videoMode = typeof videoQualityMode === 'number' ? videoQualityMode : VideoQualityModes[videoQualityMode];
    const sortMode = typeof defaultSortOrder === 'number' ? defaultSortOrder : SortOrderTypes[defaultSortOrder];
    const layoutMode =
      typeof defaultForumLayout === 'number' ? defaultForumLayout : ForumLayoutTypes[defaultForumLayout];
    if (intType === ChannelTypes.GUILD_STORE && !storeChannelDeprecationEmitted) {
      storeChannelDeprecationEmitted = true;
      process.emitWarning(
        'Creating store channels is deprecated by Discord and will stop working in March 2022. Check the docs for more info.',
        'DeprecationWarning',
      );
    }
    const data = await this.client.api.guilds(this.guild.id).channels.post({
      data: {
        name,
        topic,
        type: intType,
        nsfw,
        bitrate,
        user_limit: userLimit,
        parent_id: parent,
        position,
        permission_overwrites: permissionOverwrites,
        rate_limit_per_user: rateLimitPerUser,
        rtc_region: rtcRegion,
        video_quality_mode: videoMode,
        available_tags: availableTags?.map(availableTag => transformGuildForumTag(availableTag)),
        default_reaction_emoji: defaultReactionEmoji && transformGuildDefaultReaction(defaultReactionEmoji),
        default_sort_order: sortMode,
        default_forum_layout: layoutMode,
        default_thread_rate_limit_per_user: defaultThreadRateLimitPerUser,
      },
      reason,
    });
    return this.client.actions.ChannelCreate.handle(data).channel;
  }
  async createWebhook(channel, name, { avatar, reason } = {}) {
    const id = this.resolveId(channel);
    if (!id) throw new TypeError('INVALID_TYPE', 'channel', 'GuildChannelResolvable');
    if (typeof avatar === 'string' && !avatar.startsWith('data:')) {
      avatar = await DataResolver.resolveImage(avatar);
    }
    const data = await this.client.api.channels[id].webhooks.post({
      data: {
        name,
        avatar,
      },
      reason,
    });
    return new Webhook(this.client, data);
  }
  async addFollower(channel, targetChannel, reason) {
    const channelId = this.resolveId(channel);
    const targetChannelId = this.resolveId(targetChannel);
    if (!channelId || !targetChannelId) throw new Error('GUILD_CHANNEL_RESOLVE');
    const { webhook_id } = await this.client.api.channels[channelId].followers.post({
      data: { webhook_channel_id: targetChannelId },
      reason,
    });
    return webhook_id;
  }
  async edit(channel, data, reason) {
    channel = this.resolve(channel);
    if (!channel) throw new TypeError('INVALID_TYPE', 'channel', 'GuildChannelResolvable');
    const parentId = data.parent && this.client.channels.resolveId(data.parent);
    if (typeof data.position !== 'undefined') await this.setPosition(channel, data.position, { reason });
    let permission_overwrites = data.permissionOverwrites?.map(o => PermissionOverwrites.resolve(o, this.guild));
    if (data.lockPermissions) {
      if (parentId) {
        const newParent = this.cache.get(parentId);
        if (newParent?.type === 'GUILD_CATEGORY') {
          permission_overwrites = newParent.permissionOverwrites.cache.map(o =>
            PermissionOverwrites.resolve(o, this.guild),
          );
        }
      } else if (channel.parent) {
        permission_overwrites = channel.parent.permissionOverwrites.cache.map(o =>
          PermissionOverwrites.resolve(o, this.guild),
        );
      }
    }
    let defaultAutoArchiveDuration = data.defaultAutoArchiveDuration;
    if (defaultAutoArchiveDuration === 'MAX') defaultAutoArchiveDuration = resolveAutoArchiveMaxLimit(this.guild);
    const newData = await this.client.api.channels(channel.id).patch({
      data: {
        name: (data.name ?? channel.name).trim(),
        type: data.type,
        topic: data.topic,
        nsfw: data.nsfw,
        bitrate: data.bitrate ?? channel.bitrate,
        user_limit: data.userLimit ?? channel.userLimit,
        rtc_region: 'rtcRegion' in data ? data.rtcRegion : channel.rtcRegion,
        video_quality_mode:
          typeof data.videoQualityMode === 'string' ? VideoQualityModes[data.videoQualityMode] : data.videoQualityMode,
        parent_id: parentId,
        lock_permissions: data.lockPermissions,
        rate_limit_per_user: data.rateLimitPerUser,
        default_auto_archive_duration: defaultAutoArchiveDuration,
        permission_overwrites,
        available_tags: data.availableTags?.map(availableTag => transformGuildForumTag(availableTag)),
        default_reaction_emoji: data.defaultReactionEmoji && transformGuildDefaultReaction(data.defaultReactionEmoji),
        default_thread_rate_limit_per_user: data.defaultThreadRateLimitPerUser,
        flags: 'flags' in data ? ChannelFlags.resolve(data.flags) : undefined,
        default_sort_order:
          typeof data.defaultSortOrder === 'string' ? SortOrderTypes[data.defaultSortOrder] : data.defaultSortOrder,
      },
      reason,
    });
    return this.client.actions.ChannelUpdate.handle(newData).updated;
  }
  async setPosition(channel, position, { relative, reason } = {}) {
    channel = this.resolve(channel);
    if (!channel) throw new TypeError('INVALID_TYPE', 'channel', 'GuildChannelResolvable');
    const updatedChannels = await Util.setPosition(
      channel,
      position,
      relative,
      this.guild._sortedChannels(channel),
      this.client.api.guilds(this.guild.id).channels,
      reason,
    );
    this.client.actions.GuildChannelsPositionUpdate.handle({
      guild_id: this.guild.id,
      channels: updatedChannels,
    });
    return channel;
  }
  async fetch(id, { cache = true, force = false } = {}) {
    if (id && !force) {
      const existing = this.cache.get(id);
      if (existing) return existing;
    }
    if (id) {
      const data = await this.client.api.channels(id).get();
      if (this.guild.id !== data.guild_id) throw new Error('GUILD_CHANNEL_UNOWNED');
      return this.client.channels._add(data, this.guild, { cache });
    }
    const data = await this.client.api.guilds(this.guild.id).channels.get();
    const channels = new Collection();
    for (const channel of data) channels.set(channel.id, this.client.channels._add(channel, this.guild, { cache }));
    return channels;
  }
  async fetchWebhooks(channel) {
    const id = this.resolveId(channel);
    if (!id) throw new TypeError('INVALID_TYPE', 'channel', 'GuildChannelResolvable');
    const data = await this.client.api.channels[id].webhooks.get();
    return data.reduce((hooks, hook) => hooks.set(hook.id, new Webhook(this.client, hook)), new Collection());
  }
  async setPositions(channelPositions) {
    channelPositions = channelPositions.map(r => ({
      id: this.client.channels.resolveId(r.channel),
      position: r.position,
      lock_permissions: r.lockPermissions,
      parent_id: typeof r.parent !== 'undefined' ? this.resolveId(r.parent) : undefined,
    }));
    await this.client.api.guilds(this.guild.id).channels.patch({ data: channelPositions });
    return this.client.actions.GuildChannelsPositionUpdate.handle({
      guild_id: this.guild.id,
      channels: channelPositions,
    }).guild;
  }
  async delete(channel, reason) {
    const id = this.resolveId(channel);
    if (!id) throw new TypeError('INVALID_TYPE', 'channel', 'GuildChannelResolvable');
    await this.client.api.channels(id).delete({ reason });
  }
}
module.exports = GuildChannelManager;
