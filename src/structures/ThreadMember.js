'use strict';
const Base = require('./Base');
const ThreadMemberFlags = require('../util/ThreadMemberFlags');
class ThreadMember extends Base {
  constructor(thread, data, extra = {}) {
    super(thread.client);
    this.thread = thread;
    this.joinedTimestamp = null;
    this.id = data.user_id;
    this._patch(data, extra);
  }
  _patch(data, extra = {}) {
    if ('join_timestamp' in data) this.joinedTimestamp = new Date(data.join_timestamp).getTime();
    if ('flags' in data) {
      this.flags = new ThreadMemberFlags(data.flags).freeze();
    }
    if ('member' in data) {
      this.member = this.thread.guild.members._add(data.member, extra.cache);
    } else {
      this.member ??= null;
    }
  }
  get guildMember() {
    return this.member ?? this.thread.guild.members.cache.get(this.id) ?? null;
  }
  get joinedAt() {
    return this.joinedTimestamp ? new Date(this.joinedTimestamp) : null;
  }
  get user() {
    return this.client.users.cache.get(this.id) ?? null;
  }
  get manageable() {
    return !this.thread.archived && this.thread.editable;
  }
  async remove(reason) {
    await this.thread.members.remove(this.id, reason);
    return this;
  }
}
module.exports = ThreadMember;
