'use strict';
const { Collection } = require('@discordjs/collection');
const Base = require('./Base');
class CallState extends Base {
  constructor(client, data) {
    super(client);
    this.channelId = data.channel_id;
    this._ringing = [];
    this._patch(data);
  }
  _patch(data) {
    if ('region' in data) {
      this.region = data.region;
    }
    if ('ringing' in data) {
      this._ringing = data.ringing;
    }
  }
  get channel() {
    return this.client.channels.cache.get(this.channelId);
  }
  get ringing() {
    return new Collection(this._ringing.map(id => [id, this.client.users.cache.get(id)]));
  }
}
module.exports = CallState;
