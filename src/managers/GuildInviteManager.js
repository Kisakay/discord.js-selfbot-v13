'use strict';
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { Error } = require('../errors');
const Invite = require('../structures/Invite');
const DataResolver = require('../util/DataResolver');
class GuildInviteManager extends CachedManager {
  constructor(guild, iterable) {
    super(guild.client, Invite, iterable);
    this.guild = guild;
  }
  _add(data, cache) {
    return super._add(data, cache, { id: data.code, extras: [this.guild] });
  }
  async fetch(options) {
    if (!options) return this._fetchMany();
    if (typeof options === 'string') {
      const code = DataResolver.resolveInviteCode(options);
      if (!code) throw new Error('INVITE_RESOLVE_CODE');
      return this._fetchSingle({ code, cache: true });
    }
    if (!options.code) {
      if (options.channelId) {
        const id = this.guild.channels.resolveId(options.channelId);
        if (!id) throw new Error('GUILD_CHANNEL_RESOLVE');
        return this._fetchChannelMany(id, options.cache);
      }
      if ('cache' in options) return this._fetchMany(options.cache);
      throw new Error('INVITE_RESOLVE_CODE');
    }
    return this._fetchSingle({
      ...options,
      code: DataResolver.resolveInviteCode(options.code),
    });
  }
  async _fetchSingle({ code, cache, force = false }) {
    if (!force) {
      const existing = this.cache.get(code);
      if (existing) return existing;
    }
    const invites = await this._fetchMany(cache);
    const invite = invites.get(code);
    if (!invite) throw new Error('INVITE_NOT_FOUND');
    return invite;
  }
  async _fetchMany(cache) {
    const data = await this.client.api.guilds(this.guild.id).invites.get();
    return data.reduce((col, invite) => col.set(invite.code, this._add(invite, cache)), new Collection());
  }
  async _fetchChannelMany(channelId, cache) {
    const data = await this.client.api.channels(channelId).invites.get();
    return data.reduce((col, invite) => col.set(invite.code, this._add(invite, cache)), new Collection());
  }
  async create(
    channel,
    { temporary = false, maxAge = 86400, maxUses = 0, unique, targetUser, targetApplication, targetType, reason } = {},
  ) {
    const id = this.guild.channels.resolveId(channel);
    if (!id) throw new Error('GUILD_CHANNEL_RESOLVE');
    const invite = await this.client.api.channels(id).invites.post({
      data: {
        temporary,
        max_age: maxAge,
        max_uses: maxUses,
        unique,
        target_user_id: this.client.users.resolveId(targetUser),
        target_application_id: targetApplication?.id ?? targetApplication?.applicationId ?? targetApplication,
        target_type: targetType,
      },
      reason,
    });
    return new Invite(this.client, invite);
  }
  async delete(invite, reason) {
    const code = DataResolver.resolveInviteCode(invite);
    await this.client.api.invites(code).delete({ reason });
  }
}
module.exports = GuildInviteManager;
