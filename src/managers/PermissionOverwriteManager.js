'use strict';
const process = require('node:process');
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { TypeError } = require('../errors');
const PermissionOverwrites = require('../structures/PermissionOverwrites');
const { Role } = require('../structures/Role');
const { OverwriteTypes } = require('../util/Constants');
let cacheWarningEmitted = false;
class PermissionOverwriteManager extends CachedManager {
  constructor(channel, iterable) {
    super(channel.client, PermissionOverwrites);
    if (!cacheWarningEmitted && this._cache.constructor.name !== 'Collection') {
      cacheWarningEmitted = true;
      process.emitWarning(
        `Overriding the cache handling for ${this.constructor.name} is unsupported and breaks functionality.`,
        'UnsupportedCacheOverwriteWarning',
      );
    }
    this.channel = channel;
    if (iterable) {
      for (const item of iterable) {
        this._add(item);
      }
    }
  }
  _add(data, cache) {
    return super._add(data, cache, { extras: [this.channel] });
  }
  async set(overwrites, reason) {
    if (!Array.isArray(overwrites) && !(overwrites instanceof Collection)) {
      throw new TypeError('INVALID_TYPE', 'overwrites', 'Array or Collection of Permission Overwrites', true);
    }
    return this.channel.edit({ permissionOverwrites: overwrites, reason });
  }
  async upsert(userOrRole, options, overwriteOptions = {}, existing) {
    let userOrRoleId = this.channel.guild.roles.resolveId(userOrRole) ?? this.client.users.resolveId(userOrRole);
    let { type, reason } = overwriteOptions;
    if (typeof type !== 'number') {
      userOrRole = this.channel.guild.roles.resolve(userOrRole) ?? this.client.users.resolve(userOrRole);
      if (!userOrRole) throw new TypeError('INVALID_TYPE', 'parameter', 'User nor a Role');
      type = userOrRole instanceof Role ? OverwriteTypes.role : OverwriteTypes.member;
    }
    const { allow, deny } = PermissionOverwrites.resolveOverwriteOptions(options, existing);
    await this.client.api
      .channels(this.channel.id)
      .permissions(userOrRoleId)
      .put({
        data: { id: userOrRoleId, type, allow, deny },
        reason,
      });
    return this.channel;
  }
  create(userOrRole, options, overwriteOptions) {
    return this.upsert(userOrRole, options, overwriteOptions);
  }
  edit(userOrRole, options, overwriteOptions) {
    const existing = this.cache.get(
      this.channel.guild.roles.resolveId(userOrRole) ?? this.client.users.resolveId(userOrRole),
    );
    return this.upsert(userOrRole, options, overwriteOptions, existing);
  }
  async delete(userOrRole, reason) {
    const userOrRoleId = this.channel.guild.roles.resolveId(userOrRole) ?? this.client.users.resolveId(userOrRole);
    if (!userOrRoleId) throw new TypeError('INVALID_TYPE', 'parameter', 'User nor a Role');
    await this.client.api.channels(this.channel.id).permissions(userOrRoleId).delete({ reason });
    return this.channel;
  }
}
module.exports = PermissionOverwriteManager;
