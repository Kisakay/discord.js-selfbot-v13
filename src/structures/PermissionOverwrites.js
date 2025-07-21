'use strict';
const Base = require('./Base');
const { Role } = require('./Role');
const { TypeError } = require('../errors');
const { OverwriteTypes } = require('../util/Constants');
const Permissions = require('../util/Permissions');
class PermissionOverwrites extends Base {
  constructor(client, data, channel) {
    super(client);
    Object.defineProperty(this, 'channel', { value: channel });
    if (data) this._patch(data);
  }
  _patch(data) {
    this.id = data.id;
    if ('type' in data) {
      this.type = typeof data.type === 'number' ? OverwriteTypes[data.type] : data.type;
    }
    if ('deny' in data) {
      this.deny = new Permissions(BigInt(data.deny)).freeze();
    }
    if ('allow' in data) {
      this.allow = new Permissions(BigInt(data.allow)).freeze();
    }
  }
  async edit(options, reason) {
    await this.channel.permissionOverwrites.upsert(this.id, options, { type: OverwriteTypes[this.type], reason }, this);
    return this;
  }
  async delete(reason) {
    await this.channel.permissionOverwrites.delete(this.id, reason);
    return this;
  }
  toJSON() {
    return {
      id: this.id,
      type: OverwriteTypes[this.type],
      allow: this.allow,
      deny: this.deny,
    };
  }
  static resolveOverwriteOptions(options, { allow, deny } = {}) {
    allow = new Permissions(allow);
    deny = new Permissions(deny);
    for (const [perm, value] of Object.entries(options)) {
      if (value === true) {
        allow.add(perm);
        deny.remove(perm);
      } else if (value === false) {
        allow.remove(perm);
        deny.add(perm);
      } else if (value === null) {
        allow.remove(perm);
        deny.remove(perm);
      }
    }
    return { allow, deny };
  }
  static resolve(overwrite, guild) {
    if (overwrite instanceof this) return overwrite.toJSON();
    if (typeof overwrite.id === 'string' && overwrite.type in OverwriteTypes) {
      return {
        id: overwrite.id,
        type: OverwriteTypes[overwrite.type],
        allow: Permissions.resolve(overwrite.allow ?? Permissions.defaultBit).toString(),
        deny: Permissions.resolve(overwrite.deny ?? Permissions.defaultBit).toString(),
      };
    }
    const userOrRole = guild.roles.resolve(overwrite.id) ?? guild.client.users.resolve(overwrite.id);
    if (!userOrRole) {
      throw new TypeError('INVALID_TYPE', 'parameter', 'cached User or Role');
    }
    const type = userOrRole instanceof Role ? OverwriteTypes.role : OverwriteTypes.member;
    return {
      id: userOrRole.id,
      type,
      allow: Permissions.resolve(overwrite.allow ?? Permissions.defaultBit).toString(),
      deny: Permissions.resolve(overwrite.deny ?? Permissions.defaultBit).toString(),
    };
  }
}
module.exports = PermissionOverwrites;
