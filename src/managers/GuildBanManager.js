'use strict';
const process = require('node:process');
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { TypeError, Error } = require('../errors');
const GuildBan = require('../structures/GuildBan');
const { GuildMember } = require('../structures/GuildMember');
let deprecationEmittedForDays = false;
class GuildBanManager extends CachedManager {
  constructor(guild, iterable) {
    super(guild.client, GuildBan, iterable);
    this.guild = guild;
  }
  _add(data, cache) {
    return super._add(data, cache, { id: data.user.id, extras: [this.guild] });
  }
  resolve(ban) {
    return super.resolve(ban) ?? super.resolve(this.client.users.resolveId(ban));
  }
  async fetch(options) {
    if (!options) return this._fetchMany();
    const { user, cache, force, limit, before, after } = options;
    const resolvedUser = this.client.users.resolveId(user ?? options);
    if (resolvedUser) return this._fetchSingle({ user: resolvedUser, cache, force });
    if (!before && !after && !limit && typeof cache === 'undefined') {
      throw new Error('FETCH_BAN_RESOLVE_ID');
    }
    return this._fetchMany(options);
  }
  async _fetchSingle({ user, cache, force = false }) {
    if (!force) {
      const existing = this.cache.get(user);
      if (existing && !existing.partial) return existing;
    }
    const data = await this.client.api.guilds(this.guild.id).bans(user).get();
    return this._add(data, cache);
  }
  async _fetchMany(options = {}) {
    const data = await this.client.api.guilds(this.guild.id).bans.get({
      query: options,
    });
    return data.reduce((col, ban) => col.set(ban.user.id, this._add(ban, options.cache)), new Collection());
  }
  async create(user, options = {}) {
    if (typeof options !== 'object') throw new TypeError('INVALID_TYPE', 'options', 'object', true);
    const id = this.client.users.resolveId(user);
    if (!id) throw new Error('BAN_RESOLVE_ID', true);
    if (typeof options.days !== 'undefined' && !deprecationEmittedForDays) {
      process.emitWarning(
        'The days option for GuildBanManager#create() is deprecated. Use the deleteMessageSeconds option instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForDays = true;
    }
    await this.client.api
      .guilds(this.guild.id)
      .bans(id)
      .put({
        data: {
          delete_message_seconds:
            typeof options.deleteMessageSeconds !== 'undefined'
              ? options.deleteMessageSeconds
              : (options.days ?? 0) * 24 * 60 * 60,
        },
        reason: options.reason,
      });
    if (user instanceof GuildMember) return user;
    const _user = this.client.users.cache.get(id);
    if (_user) {
      return this.guild.members.resolve(_user) ?? _user;
    }
    return id;
  }
  async remove(user, reason) {
    const id = this.client.users.resolveId(user);
    if (!id) throw new Error('BAN_RESOLVE_ID');
    await this.client.api.guilds(this.guild.id).bans(id).delete({ reason });
    return this.client.users.resolve(user);
  }
  async bulkCreate(users, options = {}) {
    if (!users || !(Array.isArray(users) || users instanceof Collection)) {
      throw new TypeError('INVALID_TYPE', 'users', 'Array or Collection of UserResolvable', true);
    }
    if (typeof options !== 'object') throw new TypeError('INVALID_TYPE', 'options', 'object', true);
    const userIds = users.map(user => this.client.users.resolveId(user));
    if (userIds.length === 0) throw new Error('BULK_BAN_USERS_OPTION_EMPTY');
    const result = await this.client.api.guilds(this.guild.id)['bulk-ban'].post({
      data: { delete_message_days: options.deleteMessageSeconds, user_ids: userIds },
      reason: options.reason,
    });
    return { bannedUsers: result.banned_users, failedUsers: result.failed_users };
  }
}
module.exports = GuildBanManager;
