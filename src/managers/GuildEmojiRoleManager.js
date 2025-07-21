'use strict';
const { Collection } = require('@discordjs/collection');
const DataManager = require('./DataManager');
const { TypeError } = require('../errors');
const { Role } = require('../structures/Role');
class GuildEmojiRoleManager extends DataManager {
  constructor(emoji) {
    super(emoji.client, Role);
    this.emoji = emoji;
    this.guild = emoji.guild;
  }
  get cache() {
    return this.guild.roles.cache.filter(role => this.emoji._roles.includes(role.id));
  }
  async add(roleOrRoles) {
    if (!Array.isArray(roleOrRoles) && !(roleOrRoles instanceof Collection)) roleOrRoles = [roleOrRoles];
    const resolvedRoles = [];
    for (const role of roleOrRoles.values()) {
      const resolvedRole = this.guild.roles.resolveId(role);
      if (!resolvedRole) {
        throw new TypeError('INVALID_ELEMENT', 'Array or Collection', 'roles', role);
      }
      resolvedRoles.push(resolvedRole);
    }
    const newRoles = [...new Set(resolvedRoles.concat(...this.cache.keys()))];
    return this.set(newRoles);
  }
  async remove(roleOrRoles) {
    if (!Array.isArray(roleOrRoles) && !(roleOrRoles instanceof Collection)) roleOrRoles = [roleOrRoles];
    const resolvedRoleIds = [];
    for (const role of roleOrRoles.values()) {
      const roleId = this.guild.roles.resolveId(role);
      if (!roleId) {
        throw new TypeError('INVALID_ELEMENT', 'Array or Collection', 'roles', role);
      }
      resolvedRoleIds.push(roleId);
    }
    const newRoles = [...this.cache.keys()].filter(id => !resolvedRoleIds.includes(id));
    return this.set(newRoles);
  }
  set(roles) {
    return this.emoji.edit({ roles });
  }
  clone() {
    const clone = new this.constructor(this.emoji);
    clone._patch([...this.cache.keys()]);
    return clone;
  }
  _patch(roles) {
    this.emoji._roles = roles;
  }
  valueOf() {
    return this.cache;
  }
}
module.exports = GuildEmojiRoleManager;
