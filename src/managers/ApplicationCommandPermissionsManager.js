'use strict';
const { Collection } = require('@discordjs/collection');
const BaseManager = require('./BaseManager');
const { Error, TypeError } = require('../errors');
const { ApplicationCommandPermissionTypes, APIErrors } = require('../util/Constants');
class ApplicationCommandPermissionsManager extends BaseManager {
  constructor(manager) {
    super(manager.client);
    this.manager = manager;
    this.guild = manager.guild ?? null;
    this.guildId = manager.guildId ?? manager.guild?.id ?? null;
    this.commandId = manager.id ?? null;
  }
  permissionsPath(guildId, commandId) {
    return this.client.api.applications(this.client.application.id).guilds(guildId).commands(commandId).permissions;
  }
  async fetch({ guild, command } = {}) {
    const { guildId, commandId } = this._validateOptions(guild, command);
    if (commandId) {
      const data = await this.permissionsPath(guildId, commandId).get();
      return data.permissions.map(perm => this.constructor.transformPermissions(perm, true));
    }
    const data = await this.permissionsPath(guildId).get();
    return data.reduce(
      (coll, perm) =>
        coll.set(
          perm.id,
          perm.permissions.map(p => this.constructor.transformPermissions(p, true)),
        ),
      new Collection(),
    );
  }
  async set({ guild, command, permissions, fullPermissions } = {}) {
    const { guildId, commandId } = this._validateOptions(guild, command);
    if (commandId) {
      if (!Array.isArray(permissions)) {
        throw new TypeError('INVALID_TYPE', 'permissions', 'Array of ApplicationCommandPermissionData', true);
      }
      const data = await this.permissionsPath(guildId, commandId).put({
        data: { permissions: permissions.map(perm => this.constructor.transformPermissions(perm)) },
      });
      return data.permissions.map(perm => this.constructor.transformPermissions(perm, true));
    }
    if (!Array.isArray(fullPermissions)) {
      throw new TypeError('INVALID_TYPE', 'fullPermissions', 'Array of GuildApplicationCommandPermissionData', true);
    }
    const APIPermissions = [];
    for (const perm of fullPermissions) {
      if (!Array.isArray(perm.permissions)) throw new TypeError('INVALID_ELEMENT', 'Array', 'fullPermissions', perm);
      APIPermissions.push({
        id: perm.id,
        permissions: perm.permissions.map(p => this.constructor.transformPermissions(p)),
      });
    }
    const data = await this.permissionsPath(guildId).put({
      data: APIPermissions,
    });
    return data.reduce(
      (coll, perm) =>
        coll.set(
          perm.id,
          perm.permissions.map(p => this.constructor.transformPermissions(p, true)),
        ),
      new Collection(),
    );
  }
  async add({ guild, command, permissions }) {
    const { guildId, commandId } = this._validateOptions(guild, command);
    if (!commandId) throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable');
    if (!Array.isArray(permissions)) {
      throw new TypeError('INVALID_TYPE', 'permissions', 'Array of ApplicationCommandPermissionData', true);
    }
    let existing = [];
    try {
      existing = await this.fetch({ guild: guildId, command: commandId });
    } catch (error) {
      if (error.code !== APIErrors.UNKNOWN_APPLICATION_COMMAND_PERMISSIONS) throw error;
    }
    const newPermissions = permissions.slice();
    for (const perm of existing) {
      if (!newPermissions.some(x => x.id === perm.id)) {
        newPermissions.push(perm);
      }
    }
    return this.set({ guild: guildId, command: commandId, permissions: newPermissions });
  }
  async remove({ guild, command, users, roles }) {
    const { guildId, commandId } = this._validateOptions(guild, command);
    if (!commandId) throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable');
    if (!users && !roles) throw new TypeError('INVALID_TYPE', 'users OR roles', 'Array or Resolvable', true);
    let resolvedIds = [];
    if (Array.isArray(users)) {
      users.forEach(user => {
        const userId = this.client.users.resolveId(user);
        if (!userId) throw new TypeError('INVALID_ELEMENT', 'Array', 'users', user);
        resolvedIds.push(userId);
      });
    } else if (users) {
      const userId = this.client.users.resolveId(users);
      if (!userId) {
        throw new TypeError('INVALID_TYPE', 'users', 'Array or UserResolvable');
      }
      resolvedIds.push(userId);
    }
    if (Array.isArray(roles)) {
      roles.forEach(role => {
        if (typeof role === 'string') {
          resolvedIds.push(role);
          return;
        }
        if (!this.guild) throw new Error('GUILD_UNCACHED_ROLE_RESOLVE');
        const roleId = this.guild.roles.resolveId(role);
        if (!roleId) throw new TypeError('INVALID_ELEMENT', 'Array', 'users', role);
        resolvedIds.push(roleId);
      });
    } else if (roles) {
      if (typeof roles === 'string') {
        resolvedIds.push(roles);
      } else {
        if (!this.guild) throw new Error('GUILD_UNCACHED_ROLE_RESOLVE');
        const roleId = this.guild.roles.resolveId(roles);
        if (!roleId) {
          throw new TypeError('INVALID_TYPE', 'users', 'Array or RoleResolvable');
        }
        resolvedIds.push(roleId);
      }
    }
    let existing = [];
    try {
      existing = await this.fetch({ guild: guildId, command: commandId });
    } catch (error) {
      if (error.code !== APIErrors.UNKNOWN_APPLICATION_COMMAND_PERMISSIONS) throw error;
    }
    const permissions = existing.filter(perm => !resolvedIds.includes(perm.id));
    return this.set({ guild: guildId, command: commandId, permissions });
  }
  async has({ guild, command, permissionId }) {
    const { guildId, commandId } = this._validateOptions(guild, command);
    if (!commandId) throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable');
    if (!permissionId) throw new TypeError('INVALID_TYPE', 'permissionId', 'UserResolvable or RoleResolvable');
    let resolvedId = permissionId;
    if (typeof permissionId !== 'string') {
      resolvedId = this.client.users.resolveId(permissionId);
      if (!resolvedId) {
        if (!this.guild) throw new Error('GUILD_UNCACHED_ROLE_RESOLVE');
        resolvedId = this.guild.roles.resolveId(permissionId);
      }
      if (!resolvedId) {
        throw new TypeError('INVALID_TYPE', 'permissionId', 'UserResolvable or RoleResolvable');
      }
    }
    let existing = [];
    try {
      existing = await this.fetch({ guild: guildId, command: commandId });
    } catch (error) {
      if (error.code !== APIErrors.UNKNOWN_APPLICATION_COMMAND_PERMISSIONS) throw error;
    }
    return existing.some(perm => perm.id === resolvedId);
  }
  _validateOptions(guild, command) {
    const guildId = this.guildId ?? this.client.guilds.resolveId(guild);
    if (!guildId) throw new Error('GLOBAL_COMMAND_PERMISSIONS');
    let commandId = this.commandId;
    if (command && !commandId) {
      commandId = this.manager.resolveId?.(command);
      if (!commandId && this.guild) {
        commandId = this.guild.commands.resolveId(command);
      }
      commandId ??= this.client.application?.commands.resolveId(command);
      if (!commandId) {
        throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable', true);
      }
    }
    return { guildId, commandId };
  }
  static transformPermissions(permissions, received) {
    return {
      id: permissions.id,
      permission: permissions.permission,
      type:
        typeof permissions.type === 'number' && !received
          ? permissions.type
          : ApplicationCommandPermissionTypes[permissions.type],
    };
  }
}
module.exports = ApplicationCommandPermissionsManager;
