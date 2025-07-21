'use strict';
const { Channel } = require('./Channel');
const TextBasedChannel = require('./interfaces/TextBasedChannel');
const { RangeError } = require('../errors');
const MessageManager = require('../managers/MessageManager');
const ThreadMemberManager = require('../managers/ThreadMemberManager');
const ChannelFlags = require('../util/ChannelFlags');
const Permissions = require('../util/Permissions');
const { resolveAutoArchiveMaxLimit } = require('../util/Util');
class ThreadChannel extends Channel {
  constructor(guild, data, client) {
    super(guild?.client ?? client, data, false);
    this.guild = guild;
    this.ownerId = data.owner_id;
    this.guildId = guild?.id ?? data.guild_id;
    this.messages = new MessageManager(this);
    this.members = new ThreadMemberManager(this);
    if (data) this._patch(data);
  }
  _patch(data, partial = false) {
    super._patch(data);
    if ('name' in data) {
      this.name = data.name;
    }
    if ('guild_id' in data) {
      this.guildId = data.guild_id;
    }
    if ('parent_id' in data) {
      this.parentId = data.parent_id;
    } else {
      this.parentId ??= null;
    }
    if ('thread_metadata' in data) {
      this.locked = data.thread_metadata.locked ?? false;
      this.invitable = this.type === 'GUILD_PRIVATE_THREAD' ? (data.thread_metadata.invitable ?? false) : null;
      this.archived = data.thread_metadata.archived;
      this.autoArchiveDuration = data.thread_metadata.auto_archive_duration;
      this.archiveTimestamp = data.thread_metadata?.archive_timestamp
        ? Date.parse(data.thread_metadata.archive_timestamp)
        : null;
      if ('create_timestamp' in data.thread_metadata) {
        this._createdTimestamp = Date.parse(data.thread_metadata.create_timestamp);
      }
    } else {
      this.locked ??= null;
      this.archived ??= null;
      this.autoArchiveDuration ??= null;
      this.archiveTimestamp ??= null;
      this.invitable ??= null;
    }
    this._createdTimestamp ??= this.type === 'GUILD_PRIVATE_THREAD' ? super.createdTimestamp : null;
    if ('last_message_id' in data) {
      this.lastMessageId = data.last_message_id;
    } else {
      this.lastMessageId ??= null;
    }
    if ('last_pin_timestamp' in data) {
      this.lastPinTimestamp = data.last_pin_timestamp ? new Date(data.last_pin_timestamp).getTime() : null;
    } else {
      this.lastPinTimestamp ??= null;
    }
    if ('rate_limit_per_user' in data || !partial) {
      this.rateLimitPerUser = data.rate_limit_per_user ?? 0;
    } else {
      this.rateLimitPerUser ??= null;
    }
    if ('message_count' in data) {
      this.messageCount = data.message_count;
    } else {
      this.messageCount ??= null;
    }
    if ('member_count' in data) {
      this.memberCount = data.member_count;
    } else {
      this.memberCount ??= null;
    }
    if ('total_message_sent' in data) {
      this.totalMessageSent = data.total_message_sent;
    } else {
      this.totalMessageSent ??= null;
    }
    if ('applied_tags' in data) {
      this.appliedTags = data.applied_tags;
    } else {
      this.appliedTags ??= [];
    }
    if (data.member && this.client.user) this.members._add({ user_id: this.client.user.id, ...data.member });
    if (data.messages) for (const message of data.messages) this.messages._add(message);
  }
  get createdTimestamp() {
    return this._createdTimestamp;
  }
  get guildMembers() {
    return this.members.cache.mapValues(member => member.guildMember);
  }
  get archivedAt() {
    if (!this.archiveTimestamp) return null;
    return new Date(this.archiveTimestamp);
  }
  get createdAt() {
    return this.createdTimestamp && new Date(this.createdTimestamp);
  }
  get parent() {
    return this.guild.channels.resolve(this.parentId);
  }
  async join() {
    await this.members.add('@me');
    return this;
  }
  async leave() {
    await this.members.remove('@me');
    return this;
  }
  permissionsFor(memberOrRole, checkAdmin) {
    return this.parent?.permissionsFor(memberOrRole, checkAdmin) ?? null;
  }
  async fetchOwner({ cache = true, force = false } = {}) {
    if (!force) {
      const existing = this.members.cache.get(this.ownerId);
      if (existing) return existing;
    }
    const members = await this.members.fetch(cache);
    return members.get(this.ownerId) ?? null;
  }
  async fetchStarterMessage(options) {
    const channel = this.parent?.type === 'GUILD_FORUM' ? this : this.parent;
    return channel?.messages.fetch(this.id, options) ?? null;
  }
  async edit(data, reason) {
    let autoArchiveDuration = data.autoArchiveDuration;
    if (autoArchiveDuration === 'MAX') autoArchiveDuration = resolveAutoArchiveMaxLimit(this.guild);
    const newData = await this.client.api.channels(this.id).patch({
      data: {
        name: (data.name ?? this.name).trim(),
        archived: data.archived,
        auto_archive_duration: autoArchiveDuration,
        rate_limit_per_user: data.rateLimitPerUser,
        locked: data.locked,
        invitable: this.type === 'GUILD_PRIVATE_THREAD' ? data.invitable : undefined,
        applied_tags: data.appliedTags,
        flags: 'flags' in data ? ChannelFlags.resolve(data.flags) : undefined,
      },
      reason,
    });
    return this.client.actions.ChannelUpdate.handle(newData).updated;
  }
  setArchived(archived = true, reason) {
    return this.edit({ archived }, reason);
  }
  setAutoArchiveDuration(autoArchiveDuration, reason) {
    return this.edit({ autoArchiveDuration }, reason);
  }
  async setInvitable(invitable = true, reason) {
    if (this.type !== 'GUILD_PRIVATE_THREAD') throw new RangeError('THREAD_INVITABLE_TYPE', this.type);
    return this.edit({ invitable }, reason);
  }
  setLocked(locked = true, reason) {
    return this.edit({ locked }, reason);
  }
  setName(name, reason) {
    return this.edit({ name }, reason);
  }
  setRateLimitPerUser(rateLimitPerUser, reason) {
    return this.edit({ rateLimitPerUser }, reason);
  }
  pin(reason) {
    return this.edit({ flags: this.flags.add(ChannelFlags.FLAGS.PINNED) }, reason);
  }
  unpin(reason) {
    return this.edit({ flags: this.flags.remove(ChannelFlags.FLAGS.PINNED) }, reason);
  }
  setAppliedTags(appliedTags, reason) {
    return this.edit({ appliedTags }, reason);
  }
  get joined() {
    return this.members.cache.has(this.client.user?.id);
  }
  get editable() {
    return (
      (this.ownerId === this.client.user.id && (this.type !== 'GUILD_PRIVATE_THREAD' || this.joined)) || this.manageable
    );
  }
  get joinable() {
    return (
      !this.archived &&
      !this.joined &&
      this.permissionsFor(this.client.user)?.has(
        this.type === 'GUILD_PRIVATE_THREAD' ? Permissions.FLAGS.MANAGE_THREADS : Permissions.FLAGS.VIEW_CHANNEL,
        false,
      )
    );
  }
  get manageable() {
    const permissions = this.permissionsFor(this.client.user);
    if (!permissions) return false;
    if (permissions.has(Permissions.FLAGS.ADMINISTRATOR, false)) return true;
    return (
      this.guild.members.me.communicationDisabledUntilTimestamp < Date.now() &&
      permissions.has(Permissions.FLAGS.MANAGE_THREADS, false)
    );
  }
  get viewable() {
    if (this.client.user.id === this.guild.ownerId) return true;
    const permissions = this.permissionsFor(this.client.user);
    if (!permissions) return false;
    return permissions.has(Permissions.FLAGS.VIEW_CHANNEL, false);
  }
  get sendable() {
    const permissions = this.permissionsFor(this.client.user);
    if (!permissions) return false;
    if (permissions.has(Permissions.FLAGS.ADMINISTRATOR, false)) return true;
    return (
      !(this.archived && this.locked && !this.manageable) &&
      (this.type !== 'GUILD_PRIVATE_THREAD' || this.joined || this.manageable) &&
      permissions.has(Permissions.FLAGS.SEND_MESSAGES_IN_THREADS, false) &&
      this.guild.members.me.communicationDisabledUntilTimestamp < Date.now()
    );
  }
  get unarchivable() {
    return this.archived && this.sendable && (!this.locked || this.manageable);
  }
  isPrivate() {
    return this.type === 'GUILD_PRIVATE_THREAD';
  }
  async delete(reason) {
    await this.guild.channels.delete(this.id, reason);
    return this;
  }
  get lastMessage() {}
  get lastPinAt() {}
  send() {}
  sendTyping() {}
  createMessageCollector() {}
  awaitMessages() {}
}
TextBasedChannel.applyToClass(ThreadChannel, true, ['fetchWebhooks', 'setRateLimitPerUser', 'setNSFW']);
module.exports = ThreadChannel;
