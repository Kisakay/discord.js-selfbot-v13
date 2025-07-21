'use strict';
const { Channel } = require('./Channel');
const { Error } = require('../errors');
const PermissionOverwriteManager = require('../managers/PermissionOverwriteManager');
const { VoiceBasedChannelTypes } = require('../util/Constants');
const Permissions = require('../util/Permissions');
const Util = require('../util/Util');
class GuildChannel extends Channel {
  constructor(guild, data, client, immediatePatch = true) {
    super(guild?.client ?? client, data, false);
    this.guild = guild;
    this.guildId = guild?.id ?? data.guild_id;
    this.parentId = this.parentId ?? null;
    this.permissionOverwrites = new PermissionOverwriteManager(this);
    if (data && immediatePatch) this._patch(data);
  }
  _patch(data) {
    super._patch(data);
    if ('name' in data) {
      this.name = data.name;
    }
    if ('position' in data) {
      this.rawPosition = data.position;
    }
    if ('guild_id' in data) {
      this.guildId = data.guild_id;
    }
    if ('parent_id' in data) {
      this.parentId = data.parent_id;
    }
    if ('permission_overwrites' in data) {
      this.permissionOverwrites.cache.clear();
      for (const overwrite of data.permission_overwrites) {
        this.permissionOverwrites._add(overwrite);
      }
    }
  }
  _clone() {
    const clone = super._clone();
    clone.permissionOverwrites = new PermissionOverwriteManager(clone, this.permissionOverwrites.cache.values());
    return clone;
  }
  get parent() {
    return this.guild.channels.resolve(this.parentId);
  }
  get permissionsLocked() {
    if (!this.parent) return null;
    const overwriteIds = new Set([
      ...this.permissionOverwrites.cache.keys(),
      ...this.parent.permissionOverwrites.cache.keys(),
    ]);
    return [...overwriteIds].every(key => {
      const channelVal = this.permissionOverwrites.cache.get(key);
      const parentVal = this.parent.permissionOverwrites.cache.get(key);
      if (
        (!channelVal &&
          parentVal.deny.bitfield === Permissions.defaultBit &&
          parentVal.allow.bitfield === Permissions.defaultBit) ||
        (!parentVal &&
          channelVal.deny.bitfield === Permissions.defaultBit &&
          channelVal.allow.bitfield === Permissions.defaultBit)
      ) {
        return true;
      }
      return (
        typeof channelVal !== 'undefined' &&
        typeof parentVal !== 'undefined' &&
        channelVal.deny.bitfield === parentVal.deny.bitfield &&
        channelVal.allow.bitfield === parentVal.allow.bitfield
      );
    });
  }
  get position() {
    const selfIsCategory = this.type === 'GUILD_CATEGORY';
    const types = Util.getSortableGroupTypes(this.type);
    let count = 0;
    for (const channel of this.guild.channels.cache.values()) {
      if (!types.includes(channel.type)) continue;
      if (!selfIsCategory && channel.parentId !== this.parentId) continue;
      if (this.rawPosition === channel.rawPosition) {
        if (BigInt(channel.id) < BigInt(this.id)) count++;
      } else if (this.rawPosition > channel.rawPosition) {
        count++;
      }
    }
    return count;
  }
  permissionsFor(memberOrRole, checkAdmin = true) {
    const member = this.guild.members.resolve(memberOrRole);
    if (member) return this.memberPermissions(member, checkAdmin);
    const role = this.guild.roles.resolve(memberOrRole);
    return role && this.rolePermissions(role, checkAdmin);
  }
  overwritesFor(member, verified = false, roles = null) {
    if (!verified) member = this.guild.members.resolve(member);
    if (!member) return [];
    roles ??= member.roles.cache;
    const roleOverwrites = [];
    let memberOverwrites;
    let everyoneOverwrites;
    for (const overwrite of this.permissionOverwrites.cache.values()) {
      if (overwrite.id === this.guild.id) {
        everyoneOverwrites = overwrite;
      } else if (roles.has(overwrite.id)) {
        roleOverwrites.push(overwrite);
      } else if (overwrite.id === member.id) {
        memberOverwrites = overwrite;
      }
    }
    return {
      everyone: everyoneOverwrites,
      roles: roleOverwrites,
      member: memberOverwrites,
    };
  }
  memberPermissions(member, checkAdmin) {
    if (checkAdmin && member.id === this.guild.ownerId) return new Permissions(Permissions.ALL).freeze();
    const roles = member.roles.cache;
    const permissions = new Permissions(roles.map(role => role.permissions));
    if (checkAdmin && permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
      return new Permissions(Permissions.ALL).freeze();
    }
    const overwrites = this.overwritesFor(member, true, roles);
    return permissions
      .remove(overwrites.everyone?.deny ?? Permissions.defaultBit)
      .add(overwrites.everyone?.allow ?? Permissions.defaultBit)
      .remove(overwrites.roles.length > 0 ? overwrites.roles.map(role => role.deny) : Permissions.defaultBit)
      .add(overwrites.roles.length > 0 ? overwrites.roles.map(role => role.allow) : Permissions.defaultBit)
      .remove(overwrites.member?.deny ?? Permissions.defaultBit)
      .add(overwrites.member?.allow ?? Permissions.defaultBit)
      .freeze();
  }
  rolePermissions(role, checkAdmin) {
    if (checkAdmin && role.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
      return new Permissions(Permissions.ALL).freeze();
    }
    const everyoneOverwrites = this.permissionOverwrites.cache.get(this.guild.id);
    const roleOverwrites = this.permissionOverwrites.cache.get(role.id);
    return role.permissions
      .remove(everyoneOverwrites?.deny ?? Permissions.defaultBit)
      .add(everyoneOverwrites?.allow ?? Permissions.defaultBit)
      .remove(roleOverwrites?.deny ?? Permissions.defaultBit)
      .add(roleOverwrites?.allow ?? Permissions.defaultBit)
      .freeze();
  }
  async lockPermissions() {
    if (!this.parent) throw new Error('GUILD_CHANNEL_ORPHAN');
    const permissionOverwrites = this.parent.permissionOverwrites.cache.map(overwrite => overwrite.toJSON());
    return this.edit({ permissionOverwrites });
  }
  get members() {
    return this.guild.members.cache.filter(m => this.permissionsFor(m).has(Permissions.FLAGS.VIEW_CHANNEL, false));
  }
  edit(data, reason) {
    return this.guild.channels.edit(this, data, reason);
  }
  setName(name, reason) {
    return this.edit({ name }, reason);
  }
  setParent(channel, { lockPermissions = true, reason } = {}) {
    return this.edit(
      {
        parent: channel ?? null,
        lockPermissions,
      },
      reason,
    );
  }
  setPosition(position, options = {}) {
    return this.guild.channels.setPosition(this, position, options);
  }
  clone(options = {}) {
    return this.guild.channels.create(options.name ?? this.name, {
      permissionOverwrites: this.permissionOverwrites.cache,
      topic: this.topic,
      type: this.type,
      nsfw: this.nsfw,
      parent: this.parent,
      bitrate: this.bitrate,
      userLimit: this.userLimit,
      rateLimitPerUser: this.rateLimitPerUser,
      position: this.rawPosition,
      reason: null,
      ...options,
    });
  }
  equals(channel) {
    let equal =
      channel &&
      this.id === channel.id &&
      this.type === channel.type &&
      this.topic === channel.topic &&
      this.position === channel.position &&
      this.name === channel.name;
    if (equal) {
      if (this.permissionOverwrites && channel.permissionOverwrites) {
        equal = this.permissionOverwrites.cache.equals(channel.permissionOverwrites.cache);
      } else {
        equal = !this.permissionOverwrites && !channel.permissionOverwrites;
      }
    }
    return equal;
  }
  get deletable() {
    return this.manageable && this.guild.rulesChannelId !== this.id && this.guild.publicUpdatesChannelId !== this.id;
  }
  get manageable() {
    if (this.client.user.id === this.guild.ownerId) return true;
    const permissions = this.permissionsFor(this.client.user);
    if (!permissions) return false;
    if (permissions.has(Permissions.FLAGS.ADMINISTRATOR, false)) return true;
    if (this.guild.members.me.communicationDisabledUntilTimestamp > Date.now()) return false;
    const bitfield = VoiceBasedChannelTypes.includes(this.type)
      ? Permissions.FLAGS.MANAGE_CHANNELS | Permissions.FLAGS.CONNECT
      : Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.MANAGE_CHANNELS;
    return permissions.has(bitfield, false);
  }
  get viewable() {
    if (this.client.user.id === this.guild.ownerId) return true;
    const permissions = this.permissionsFor(this.client.user);
    if (!permissions) return false;
    return permissions.has(Permissions.FLAGS.VIEW_CHANNEL, false);
  }
  async delete(reason) {
    await this.guild.channels.delete(this.id, reason);
    return this;
  }
}
module.exports = GuildChannel;
