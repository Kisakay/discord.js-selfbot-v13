'use strict';
const { isJSONEncodable } = require('@discordjs/builders');
const { Collection } = require('@discordjs/collection');
const ApplicationCommandPermissionsManager = require('./ApplicationCommandPermissionsManager');
const CachedManager = require('./CachedManager');
const { TypeError } = require('../errors');
const ApplicationCommand = require('../structures/ApplicationCommand');
const { ApplicationCommandTypes } = require('../util/Constants');
const Permissions = require('../util/Permissions');
class ApplicationCommandManager extends CachedManager {
  constructor(client, iterable) {
    super(client, ApplicationCommand, iterable);
    this.permissions = new ApplicationCommandPermissionsManager(this);
  }
  _add(data, cache, guildId) {
    return super._add(data, cache, { extras: [this.guild, guildId] });
  }
  commandPath({ id, guildId } = {}) {
    let path = this.client.api.applications(this.client.application.id);
    if (this.guild ?? guildId) path = path.guilds(this.guild?.id ?? guildId);
    return id ? path.commands(id) : path.commands;
  }
  async fetch(id, { guildId, cache = true, force = false, locale, withLocalizations } = {}) {
    if (typeof id === 'object') {
      ({ guildId, cache = true, locale, withLocalizations } = id);
    } else if (id) {
      if (!force) {
        const existing = this.cache.get(id);
        if (existing) return existing;
      }
      const command = await this.commandPath({ id, guildId }).get();
      return this._add(command, cache);
    }
    const data = await this.commandPath({ guildId }).get({
      headers: {
        'X-Discord-Locale': locale,
      },
      query: typeof withLocalizations === 'boolean' ? { with_localizations: withLocalizations } : undefined,
    });
    return data.reduce((coll, command) => coll.set(command.id, this._add(command, cache, guildId)), new Collection());
  }
  async create(command, guildId) {
    const data = await this.commandPath({ guildId }).post({
      data: this.constructor.transformCommand(command),
    });
    return this._add(data, true, guildId);
  }
  async set(commands, guildId) {
    const data = await this.commandPath({ guildId }).put({
      data: commands.map(c => this.constructor.transformCommand(c)),
    });
    return data.reduce((coll, command) => coll.set(command.id, this._add(command, true, guildId)), new Collection());
  }
  async edit(command, data, guildId) {
    const id = this.resolveId(command);
    if (!id) throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable');
    const patched = await this.commandPath({ id, guildId }).patch({
      data: this.constructor.transformCommand(data),
    });
    return this._add(patched, true, guildId);
  }
  async delete(command, guildId) {
    const id = this.resolveId(command);
    if (!id) throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable');
    await this.commandPath({ id, guildId }).delete();
    const cached = this.cache.get(id);
    this.cache.delete(id);
    return cached ?? null;
  }
  static transformCommand(command) {
    if (isJSONEncodable(command)) return command.toJSON();
    let default_member_permissions;
    if ('default_member_permissions' in command) {
      default_member_permissions = command.default_member_permissions
        ? new Permissions(BigInt(command.default_member_permissions)).bitfield.toString()
        : command.default_member_permissions;
    }
    if ('defaultMemberPermissions' in command) {
      default_member_permissions =
        command.defaultMemberPermissions !== null
          ? new Permissions(command.defaultMemberPermissions).bitfield.toString()
          : command.defaultMemberPermissions;
    }
    return {
      name: command.name,
      name_localizations: command.nameLocalizations ?? command.name_localizations,
      description: command.description,
      description_localizations: command.descriptionLocalizations ?? command.description_localizations,
      type: typeof command.type === 'number' ? command.type : ApplicationCommandTypes[command.type],
      options: command.options?.map(o => ApplicationCommand.transformOption(o)),
      default_permission: command.defaultPermission ?? command.default_permission,
      default_member_permissions,
      dm_permission: command.dmPermission ?? command.dm_permission,
    };
  }
}
module.exports = ApplicationCommandManager;
