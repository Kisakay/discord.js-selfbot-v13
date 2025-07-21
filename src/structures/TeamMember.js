'use strict';
const Base = require('./Base');
const { MembershipStates } = require('../util/Constants');
class TeamMember extends Base {
  constructor(team, data) {
    super(team.client);
    this.team = team;
    this._patch(data);
  }
  _patch(data) {
    if ('permissions' in data) {
      this.permissions = data.permissions;
    }
    if ('role' in data) {
      this.role = data.role;
    }
    if ('membership_state' in data) {
      this.membershipState = MembershipStates[data.membership_state];
    }
    if ('user' in data) {
      this.user = this.client.users._add(data.user);
    }
  }
  get id() {
    return this.user.id;
  }
  toString() {
    return this.user.toString();
  }
}
module.exports = TeamMember;
