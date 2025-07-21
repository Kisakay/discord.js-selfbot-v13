'use strict';
const { Collection } = require('@discordjs/collection');
const DataManager = require('./DataManager');
const { TypeError } = require('../errors');
const { Role } = require('../structures/Role');
class GuildMemberRoleManager extends DataManager {
  constructor(member) {
    super(member.client, Role);
    this.member = member;
    this.guild = member.guild;
  }
  get cache() {
    const everyone = this.guild.roles.everyone;
    return this.guild.roles.cache.filter(role => this.member._roles.includes(role.id)).set(everyone.id, everyone);
  }
  get hoist() {
    const hoistedRoles = this.cache.filter(role => role.hoist);
    if (!hoistedRoles.size) return null;
    return hoistedRoles.reduce((prev, role) => (role.comparePositionTo(prev) > 0 ? role : prev));
  }
  get icon() {
    const iconRoles = this.cache.filter(role => role.icon || role.unicodeEmoji);
    if (!iconRoles.size) return null;
    return iconRoles.reduce((prev, role) => (role.comparePositionTo(prev) > 0 ? role : prev));
  }
  get color() {
    const coloredRoles = this.cache.filter(role => role.color);
    if (!coloredRoles.size) return null;
    return coloredRoles.reduce((prev, role) => (role.comparePositionTo(prev) > 0 ? role : prev));
  }
  get highest() {
    return this.cache.reduce((prev, role) => (role.comparePositionTo(prev) > 0 ? role : prev), this.cache.first());
  }
  get premiumSubscriberRole() {
    return this.cache.find(role => role.tags?.premiumSubscriberRole) ?? null;
  }
  get botRole() {
    if (!this.member.user.bot) return null;
    return this.cache.find(role => role.tags?.botId === this.member.user.id) ?? null;
  }
  async add(roleOrRoles, reason) {
    if (roleOrRoles instanceof Collection || Array.isArray(roleOrRoles)) {
      const resolvedRoles = [];
      for (const role of roleOrRoles.values()) {
        const resolvedRole = this.guild.roles.resolveId(role);
        if (!resolvedRole) throw new TypeError('INVALID_ELEMENT', 'Array or Collection', 'roles', role);
        resolvedRoles.push(resolvedRole);
      }
      const newRoles = [...new Set(resolvedRoles.concat(...this.cache.keys()))];
      return this.set(newRoles, reason);
    } else {
      roleOrRoles = this.guild.roles.resolveId(roleOrRoles);
      if (roleOrRoles === null) {
        throw new TypeError('INVALID_TYPE', 'roles', 'Role, Snowflake or Array or Collection of Roles or Snowflakes');
      }
      await this.client.api.guilds[this.guild.id].members[this.member.id].roles[roleOrRoles].put({ reason });
      const clone = this.member._clone();
      clone._roles = [...this.cache.keys(), roleOrRoles];
      return clone;
    }
  }
  async remove(roleOrRoles, reason) {
    if (roleOrRoles instanceof Collection || Array.isArray(roleOrRoles)) {
      const resolvedRoles = [];
      for (const role of roleOrRoles.values()) {
        const resolvedRole = this.guild.roles.resolveId(role);
        if (!resolvedRole) throw new TypeError('INVALID_ELEMENT', 'Array or Collection', 'roles', role);
        resolvedRoles.push(resolvedRole);
      }
      const newRoles = this.cache.filter(role => !resolvedRoles.includes(role.id));
      return this.set(newRoles, reason);
    } else {
      roleOrRoles = this.guild.roles.resolveId(roleOrRoles);
      if (roleOrRoles === null) {
        throw new TypeError('INVALID_TYPE', 'roles', 'Role, Snowflake or Array or Collection of Roles or Snowflakes');
      }
      await this.client.api.guilds[this.guild.id].members[this.member.id].roles[roleOrRoles].delete({ reason });
      const clone = this.member._clone();
      const newRoles = this.cache.filter(role => role.id !== roleOrRoles);
      clone._roles = [...newRoles.keys()];
      return clone;
    }
  }
  set(roles, reason) {
    return this.member.edit({ roles }, reason);
  }
  clone() {
    const clone = new this.constructor(this.member);
    clone.member._roles = [...this.cache.keys()];
    return clone;
  }
}
module.exports = GuildMemberRoleManager;
