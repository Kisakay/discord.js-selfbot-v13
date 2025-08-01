'use strict';
const CachedManager = require('./CachedManager');
const { Error } = require('../errors');
const { GuildMember } = require('../structures/GuildMember');
const { Message } = require('../structures/Message');
const ThreadMember = require('../structures/ThreadMember');
const User = require('../structures/User');
class UserManager extends CachedManager {
  constructor(client, iterable) {
    super(client, User, iterable);
  }
  dmChannel(userId) {
    return this.client.channels.cache.find(c => c.type === 'DM' && c.recipient.id === userId) ?? null;
  }
  async createDM(user, { cache = true, force = false } = {}) {
    const id = this.resolveId(user);
    if (!force) {
      const dmChannel = this.dmChannel(id);
      if (dmChannel && !dmChannel.partial) return dmChannel;
    }
    const data = await this.client.api.users['@me'].channels.post({
      data: {
        recipients: [id],
      },
      DiscordContext: {},
    });
    const dm_channel = await this.client.channels._add(data, null, { cache });
    dm_channel.sync();
    return dm_channel;
  }
  async deleteDM(user) {
    const id = this.resolveId(user);
    const dmChannel = this.dmChannel(id);
    if (!dmChannel) throw new Error('USER_NO_DM_CHANNEL');
    await this.client.api.channels(dmChannel.id).delete();
    this.client.channels._remove(dmChannel.id);
    return dmChannel;
  }
  async fetch(user, { cache = true, force = false } = {}) {
    const id = this.resolveId(user);
    if (!force) {
      const existing = this.cache.get(id);
      if (existing && !existing.partial) return existing;
    }
    const data = await this.client.api.users(id).get();
    return this._add(data, cache);
  }
  async send(user, options) {
    return (await this.createDM(user)).send(options);
  }
  resolve(user) {
    if (user instanceof GuildMember || user instanceof ThreadMember) return user.user;
    if (user instanceof Message) return user.author;
    return super.resolve(user);
  }
  resolveId(user) {
    if (user instanceof ThreadMember) return user.id;
    if (user instanceof GuildMember) return user.user.id;
    if (user instanceof Message) return user.author.id;
    return super.resolveId(user);
  }
}
module.exports = UserManager;
