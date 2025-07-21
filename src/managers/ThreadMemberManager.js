'use strict';
const process = require('node:process');
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { TypeError } = require('../errors');
const ThreadMember = require('../structures/ThreadMember');
let deprecationEmittedForPassingBoolean = false;
class ThreadMemberManager extends CachedManager {
  constructor(thread, iterable) {
    super(thread.client, ThreadMember, iterable);
    this.thread = thread;
  }
  _add(data, cache = true) {
    const existing = this.cache.get(data.user_id);
    if (cache) existing?._patch(data, { cache });
    if (existing) return existing;
    const member = new ThreadMember(this.thread, data, { cache });
    if (cache) this.cache.set(data.user_id, member);
    return member;
  }
  fetchMe(options) {
    return this.fetch(this.client.user.id, options);
  }
  get me() {
    return this.cache.get(this.client.user.id) ?? null;
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
    const userResolvable = this.client.users.resolveId(member);
    return this.cache.has(userResolvable) ? userResolvable : null;
  }
  async add(member, reason) {
    const id = member === '@me' ? member : this.client.users.resolveId(member);
    if (!id) throw new TypeError('INVALID_TYPE', 'member', 'UserResolvable');
    await this.client.api.channels(this.thread.id, 'thread-members', id).put({ reason });
    return id;
  }
  async remove(id, reason) {
    await this.client.api.channels(this.thread.id, 'thread-members', id).delete({ reason });
    return id;
  }
  async _fetchOne(memberId, { cache, force = false, withMember }) {
    if (!force) {
      const existing = this.cache.get(memberId);
      if (existing) return existing;
    }
    const data = await this.client.api.channels(this.thread.id, 'thread-members', memberId).get({
      query: { with_member: withMember },
    });
    return this._add(data, cache);
  }
  async _fetchMany({ cache, limit, after, withMember } = {}) {
    const raw = await this.client.api.channels(this.thread.id, 'thread-members').get({
      query: { with_member: withMember, limit, after },
    });
    return raw.reduce((col, member) => col.set(member.user_id, this._add(member, cache)), new Collection());
  }
  fetch(member, options = { cache: true, force: false }) {
    if (typeof member === 'boolean' && !deprecationEmittedForPassingBoolean) {
      process.emitWarning(
        'Passing boolean to member option is deprecated, use cache property instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForPassingBoolean = true;
    }
    const id = this.resolveId(member);
    return id
      ? this._fetchOne(id, options)
      : this._fetchMany(typeof member === 'boolean' ? { ...options, cache: member } : options);
  }
}
module.exports = ThreadMemberManager;
