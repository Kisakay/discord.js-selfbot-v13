'use strict';
const { Collection } = require('@discordjs/collection');
const Base = require('./Base');
const TeamMember = require('./TeamMember');
const SnowflakeUtil = require('../util/SnowflakeUtil');
class Team extends Base {
  constructor(client, data) {
    super(client);
    this._patch(data);
  }
  _patch(data) {
    this.id = data.id;
    if ('name' in data) {
      this.name = data.name;
    }
    if ('icon' in data) {
      this.icon = data.icon;
    } else {
      this.icon ??= null;
    }
    if ('owner_user_id' in data) {
      this.ownerId = data.owner_user_id;
    } else {
      this.ownerId ??= null;
    }
    this.members = new Collection();
    for (const memberData of data.members) {
      const member = new TeamMember(this, memberData);
      this.members.set(member.id, member);
    }
  }
  get owner() {
    return this.members.get(this.ownerId) ?? null;
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  iconURL({ format, size } = {}) {
    if (!this.icon) return null;
    return this.client.rest.cdn.TeamIcon(this.id, this.icon, { format, size });
  }
  toString() {
    return this.name;
  }
  toJSON() {
    return super.toJSON({ createdTimestamp: true });
  }
}
module.exports = Team;
