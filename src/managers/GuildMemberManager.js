'use strict';
const { Buffer } = require('node:buffer');
const { setTimeout } = require('node:timers');
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { Error, TypeError, RangeError } = require('../errors');
const { GuildMember } = require('../structures/GuildMember');
const { Role } = require('../structures/Role');
const { Events, Opcodes } = require('../util/Constants');
const { PartialTypes } = require('../util/Constants');
const DataResolver = require('../util/DataResolver');
const GuildMemberFlags = require('../util/GuildMemberFlags');
const SnowflakeUtil = require('../util/SnowflakeUtil');
class GuildMemberManager extends CachedManager {
  constructor(guild, iterable) {
    super(guild.client, GuildMember, iterable);
    this.guild = guild;
  }
  _add(data, cache = true) {
    return super._add(data, cache, { id: data.user.id, extras: [this.guild] });
  }
  resolve(member) {
    const memberResolvable = super.resolve(member);
    if (memberResolvable) return memberResolvable;
    const userId = this.client.users.resolveId(member);
    if (userId) return this.cache.get(userId) ?? null;
    return null;
  }
  resolveId(member) {
    const memberResolvable = super.resolveId(member);
    if (memberResolvable) return memberResolvable;
    const userId = this.client.users.resolveId(member);
    return this.cache.has(userId) ? userId : null;
  }
  async add(user, options) {
    const userId = this.client.users.resolveId(user);
    if (!userId) throw new TypeError('INVALID_TYPE', 'user', 'UserResolvable');
    if (!options.force) {
      const cachedUser = this.cache.get(userId);
      if (cachedUser) return cachedUser;
    }
    const resolvedOptions = {
      access_token: options.accessToken,
      nick: options.nick,
      mute: options.mute,
      deaf: options.deaf,
    };
    if (options.roles) {
      if (!Array.isArray(options.roles) && !(options.roles instanceof Collection)) {
        throw new TypeError('INVALID_TYPE', 'options.roles', 'Array or Collection of Roles or Snowflakes', true);
      }
      const resolvedRoles = [];
      for (const role of options.roles.values()) {
        const resolvedRole = this.guild.roles.resolveId(role);
        if (!resolvedRole) throw new TypeError('INVALID_ELEMENT', 'Array or Collection', 'options.roles', role);
        resolvedRoles.push(resolvedRole);
      }
      resolvedOptions.roles = resolvedRoles;
    }
    const data = await this.client.api.guilds(this.guild.id).members(userId).put({ data: resolvedOptions });
    return data instanceof Buffer ? (options.fetchWhenExisting === false ? null : this.fetch(userId)) : this._add(data);
  }
  get me() {
    return (
      this.cache.get(this.client.user.id) ??
      (this.client.options.partials.includes(PartialTypes.GUILD_MEMBER)
        ? this._add({ user: { id: this.client.user.id } }, true)
        : null)
    );
  }
  fetch(options) {
    if (!options) {
      if (
        this.me.permissions.has('KICK_MEMBERS') ||
        this.me.permissions.has('BAN_MEMBERS') ||
        this.me.permissions.has('MANAGE_ROLES')
      ) {
        return this._fetchMany();
      } else {
        return this.fetchByMemberSafety();
      }
    }
    const user = this.client.users.resolveId(options);
    if (user) return this._fetchSingle({ user, cache: true });
    if (options.user) {
      if (Array.isArray(options.user)) {
        options.user = options.user.map(u => this.client.users.resolveId(u));
        return this._fetchMany(options);
      } else {
        options.user = this.client.users.resolveId(options.user);
      }
      if (!options.limit && !options.withPresences) return this._fetchSingle(options);
    }
    return this._fetchMany(options);
  }
  fetchMe(options) {
    return this.fetch({ ...options, user: this.client.user.id });
  }
  async search({ query, limit = 1, cache = true } = {}) {
    const data = await this.client.api.guilds(this.guild.id).members.search.get({ query: { query, limit } });
    return data.reduce((col, member) => col.set(member.user.id, this._add(member, cache)), new Collection());
  }
  async edit(user, data, reason) {
    const id = this.client.users.resolveId(user);
    if (!id) throw new TypeError('INVALID_TYPE', 'user', 'UserResolvable');
    const _data = { ...data };
    if (_data.channel) {
      _data.channel = this.guild.channels.resolve(_data.channel);
      _data.channel_id = _data.channel.id;
      _data.channel = undefined;
    } else if (_data.channel === null) {
      _data.channel_id = null;
      _data.channel = undefined;
    }
    _data.roles &&= _data.roles.map(role => (role instanceof Role ? role.id : role));
    _data.communication_disabled_until =
      _data.communicationDisabledUntil && new Date(_data.communicationDisabledUntil).toISOString();
    _data.flags = _data.flags && GuildMemberFlags.resolve(_data.flags);
    if (typeof _data.avatar !== 'undefined') {
      _data.avatar = await DataResolver.resolveImage(_data.avatar);
    }
    if (typeof _data.banner !== 'undefined') {
      _data.banner = await DataResolver.resolveImage(_data.banner);
    }
    let endpoint = this.client.api.guilds(this.guild.id);
    if (id === this.client.user.id) {
      const keys = Object.keys(data);
      if (keys.length === 1 && ['nick', 'avatar', 'banner', 'bio'].includes(keys[0])) {
        endpoint = endpoint.members('@me');
      } else {
        endpoint = endpoint.members(id);
      }
    } else {
      endpoint = endpoint.members(id);
    }
    const d = await endpoint.patch({ data: _data, reason });
    const clone = this.cache.get(id)?._clone();
    clone?._patch(d);
    return clone ?? this._add(d, false);
  }
  async prune({ days = 7, dry = false, count: compute_prune_count = true, roles = [], reason } = {}) {
    if (typeof days !== 'number') throw new TypeError('PRUNE_DAYS_TYPE');
    const query = { days };
    const resolvedRoles = [];
    for (const role of roles) {
      const resolvedRole = this.guild.roles.resolveId(role);
      if (!resolvedRole) {
        throw new TypeError('INVALID_ELEMENT', 'Array', 'options.roles', role);
      }
      resolvedRoles.push(resolvedRole);
    }
    if (resolvedRoles.length) {
      query.include_roles = dry ? resolvedRoles.join(',') : resolvedRoles;
    }
    const endpoint = this.client.api.guilds(this.guild.id).prune;
    const { pruned } = await (dry
      ? endpoint.get({ query, reason })
      : endpoint.post({ data: { ...query, compute_prune_count }, reason }));
    return pruned;
  }
  async kick(user, reason) {
    const id = this.client.users.resolveId(user);
    if (!id) throw new TypeError('INVALID_TYPE', 'user', 'UserResolvable');
    await this.client.api.guilds(this.guild.id).members(id).delete({ reason });
    return this.resolve(user) ?? this.client.users.resolve(user) ?? id;
  }
  ban(user, options) {
    return this.guild.bans.create(user, options);
  }
  unban(user, reason) {
    return this.guild.bans.remove(user, reason);
  }
  async _fetchSingle({ user, cache, force = false }) {
    if (!force) {
      const existing = this.cache.get(user);
      if (existing && !existing.partial) return existing;
    }
    const data = await this.client.api.guilds(this.guild.id).members(user).get();
    return this._add(data, cache);
  }
  async addRole(user, role, reason) {
    const userId = this.resolveId(user);
    const roleId = this.guild.roles.resolveId(role);
    await this.client.api.guilds(this.guild.id).members(userId).roles(roleId).put({ reason });
    return this.resolve(user) ?? this.client.users.resolve(user) ?? userId;
  }
  async removeRole(user, role, reason) {
    const userId = this.resolveId(user);
    const roleId = this.guild.roles.resolveId(role);
    await this.client.api.guilds(this.guild.id).members(userId).roles(roleId).delete({ reason });
    return this.resolve(user) ?? this.client.users.resolve(user) ?? userId;
  }
  fetchByMemberSafety(timeout = 15_000) {
    return new Promise(resolve => {
      const nonce = SnowflakeUtil.generate();
      const fetchedMembers = new Collection();
      let timeout_ = setTimeout(() => {
        this.client.removeListener(Events.GUILD_MEMBERS_CHUNK, handler);
        resolve(fetchedMembers);
      }, timeout).unref();
      const handler = (members, guild, chunk) => {
        if (guild.id == this.guild.id && chunk.nonce == nonce) {
          if (members.size > 0) {
            for (const member of members.values()) {
              fetchedMembers.set(member.id, member);
            }
            this.client.ws.broadcast({
              op: Opcodes.SEARCH_RECENT_MEMBERS,
              d: {
                guild_id: this.guild.id,
                query: '',
                continuation_token: members.first()?.id,
                nonce,
              },
            });
          } else {
            clearTimeout(timeout_);
            this.client.removeListener(Events.GUILD_MEMBERS_CHUNK, handler);
            resolve(fetchedMembers);
          }
        }
      };
      this.client.on(Events.GUILD_MEMBERS_CHUNK, handler);
      this.client.ws.broadcast({
        op: Opcodes.SEARCH_RECENT_MEMBERS,
        d: {
          guild_id: this.guild.id,
          query: '',
          continuation_token: null,
          nonce,
        },
      });
    });
  }
  _fetchMany({
    limit = 0,
    withPresences: presences = true,
    user: user_ids,
    query,
    time = 120e3,
    nonce = SnowflakeUtil.generate(),
  } = {}) {
    return new Promise((resolve, reject) => {
      if (!query && !user_ids) query = '';
      if (nonce.length > 32) throw new RangeError('MEMBER_FETCH_NONCE_LENGTH');
      this.guild.shard.send({
        op: Opcodes.REQUEST_GUILD_MEMBERS,
        d: {
          guild_id: this.guild.id,
          presences,
          user_ids,
          query,
          nonce,
          limit,
        },
      });
      const fetchedMembers = new Collection();
      let i = 0;
      const handler = (members, _, chunk) => {
        timeout.refresh();
        if (chunk.nonce !== nonce) return;
        i++;
        for (const member of members.values()) {
          fetchedMembers.set(member.id, member);
        }
        if (members.size < 1_000 || (limit && fetchedMembers.size >= limit) || i === chunk.count) {
          clearTimeout(timeout);
          this.client.removeListener(Events.GUILD_MEMBERS_CHUNK, handler);
          this.client.decrementMaxListeners();
          let fetched = fetchedMembers;
          if (user_ids && !Array.isArray(user_ids) && fetched.size) fetched = fetched.first();
          resolve(fetched);
        }
      };
      const timeout = setTimeout(() => {
        this.client.removeListener(Events.GUILD_MEMBERS_CHUNK, handler);
        this.client.decrementMaxListeners();
        reject(new Error('GUILD_MEMBERS_TIMEOUT'));
      }, time).unref();
      this.client.incrementMaxListeners();
      this.client.on(Events.GUILD_MEMBERS_CHUNK, handler);
    });
  }
  bulkBan(users, options = {}) {
    return this.guild.bans.bulkCreate(users, options);
  }
}
module.exports = GuildMemberManager;
