'use strict';
const Base = require('./Base');
class Session extends Base {
  constructor(client, data) {
    super(client);
    this._patch(data);
  }
  _patch(data) {
    if ('id_hash' in data) {
      this.id = data.id_hash;
    }
    if ('approx_last_used_time' in data) {
      this.approxLastUsedTime = data.approx_last_used_time;
    }
    if ('client_info' in data) {
      this.clientInfo = data.client_info;
    }
  }
  get createdTimestamp() {
    return this.createdAt.getTime();
  }
  get createdAt() {
    return new Date(this.approxLastUsedTime);
  }
  logout() {
    return this.client.api.auth.sessions.logout({
      data: {
        session_id_hashes: [this.id],
      },
    });
  }
  toJSON() {
    return super.toJSON();
  }
}
module.exports = Session;
