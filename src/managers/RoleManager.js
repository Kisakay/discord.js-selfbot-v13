'use strict';
const process = require('node:process');
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { TypeError } = require('../errors');
const { Role } = require('../structures/Role');
const DataResolver = require('../util/DataResolver');
const Permissions = require('../util/Permissions');
const { resolveColor } = require('../util/Util');
const Util = require('../util/Util');
let cacheWarningEmitted = false;
class RoleManager extends CachedManager {
  constructor(guild, iterable) {
    super(guild.client, Role, iterable);
    if (!cacheWarningEmitted && this._cache.constructor.name !== 'Collection') {
      cacheWarningEmitted = true;
      process.emitWarning(
        `Overriding the cache handling for ${this.constructor.name} is unsupported and breaks functionality.`,
        'UnsupportedCacheOverwriteWarning',
      );
    }
    this.guild = guild;
  }
  _add(data, cache) {
    return super._add(data, cache, { extras: [this.guild] });
  }
  async fetch(id, { cache = true, force = false } = {}) {
    if (id && !force) {
      const existing = this.cache.get(id);
      if (existing) return existing;
    }
    const data = await this.client.api.guilds(this.guild.id).roles.get();
    const roles = new Collection();
    for (const role of data) roles.set(role.id, this._add(role, cache));
    return id ? (roles.get(id) ?? null) : roles;
  }
  async fetchMemberCounts() {
    const data = await this.client.api.guilds(this.guild.id).roles('member-counts').get();
    return data;
  }
  async fetchMemberIds(role) {
    const id = this.resolveId(role);
    if (!id) throw new TypeError('INVALID_TYPE', 'role', 'RoleResolvable');
    const data = await this.client.api.guilds(this.guild.id).roles(id, 'member-ids').get();
    return data;
  }
  async create(options = {}) {
    let { name, color, hoist, permissions, position, mentionable, reason, icon, unicodeEmoji } = options;
    color &&= resolveColor(color);
    if (typeof permissions !== 'undefined') permissions = new Permissions(permissions);
    if (icon) {
      const guildEmojiURL = this.guild.emojis.resolve(icon)?.url;
      icon = guildEmojiURL ? await DataResolver.resolveImage(guildEmojiURL) : await DataResolver.resolveImage(icon);
      if (typeof icon !== 'string') icon = undefined;
    }
    const data = await this.client.api.guilds(this.guild.id).roles.post({
      data: {
        name,
        color,
        hoist,
        permissions,
        mentionable,
        icon,
        unicode_emoji: unicodeEmoji,
      },
      reason,
    });
    const { role } = this.client.actions.GuildRoleCreate.handle({
      guild_id: this.guild.id,
      role: data,
    });
    if (position) return this.setPosition(role, position, { reason });
    return role;
  }
  async edit(role, data, reason) {
    role = this.resolve(role);
    if (!role) throw new TypeError('INVALID_TYPE', 'role', 'RoleResolvable');
    if (typeof data.position === 'number') await this.setPosition(role, data.position, { reason });
    let icon = data.icon;
    if (icon) {
      const guildEmojiURL = this.guild.emojis.resolve(icon)?.url;
      icon = guildEmojiURL ? await DataResolver.resolveImage(guildEmojiURL) : await DataResolver.resolveImage(icon);
      if (typeof icon !== 'string') icon = undefined;
    }
    const _data = {
      name: data.name,
      color: typeof data.color === 'undefined' ? undefined : resolveColor(data.color),
      hoist: data.hoist,
      permissions: typeof data.permissions === 'undefined' ? undefined : new Permissions(data.permissions),
      mentionable: data.mentionable,
      icon,
      unicode_emoji: data.unicodeEmoji,
    };
    const d = await this.client.api.guilds(this.guild.id).roles(role.id).patch({ data: _data, reason });
    const clone = role._clone();
    clone._patch(d);
    return clone;
  }
  async delete(role, reason) {
    const id = this.resolveId(role);
    await this.client.api.guilds[this.guild.id].roles[id].delete({ reason });
    this.client.actions.GuildRoleDelete.handle({ guild_id: this.guild.id, role_id: id });
  }
  async setPosition(role, position, { relative, reason } = {}) {
    role = this.resolve(role);
    if (!role) throw new TypeError('INVALID_TYPE', 'role', 'RoleResolvable');
    const updatedRoles = await Util.setPosition(
      role,
      position,
      relative,
      this.guild._sortedRoles(),
      this.client.api.guilds(this.guild.id).roles,
      reason,
    );
    this.client.actions.GuildRolesPositionUpdate.handle({
      guild_id: this.guild.id,
      roles: updatedRoles,
    });
    return role;
  }
  async setPositions(rolePositions) {
    rolePositions = rolePositions.map(o => ({
      id: this.resolveId(o.role),
      position: o.position,
    }));
    await this.client.api.guilds(this.guild.id).roles.patch({
      data: rolePositions,
    });
    return this.client.actions.GuildRolesPositionUpdate.handle({
      guild_id: this.guild.id,
      roles: rolePositions,
    }).guild;
  }
  comparePositions(role1, role2) {
    const resolvedRole1 = this.resolve(role1);
    const resolvedRole2 = this.resolve(role2);
    if (!resolvedRole1 || !resolvedRole2) throw new TypeError('INVALID_TYPE', 'role', 'Role nor a Snowflake');
    const role1Position = resolvedRole1.position;
    const role2Position = resolvedRole2.position;
    if (role1Position === role2Position) {
      return Number(BigInt(resolvedRole2.id) - BigInt(resolvedRole1.id));
    }
    return role1Position - role2Position;
  }
  botRoleFor(user) {
    const userId = this.client.users.resolveId(user);
    if (!userId) return null;
    return this.cache.find(role => role.tags?.botId === userId) ?? null;
  }
  get everyone() {
    return this.cache.get(this.guild.id);
  }
  get premiumSubscriberRole() {
    return this.cache.find(role => role.tags?.premiumSubscriberRole) ?? null;
  }
  get highest() {
    return this.cache.reduce((prev, role) => (role.comparePositionTo(prev) > 0 ? role : prev), this.cache.first());
  }
}
module.exports = RoleManager;
