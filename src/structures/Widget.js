'use strict';
const { Collection } = require('@discordjs/collection');
const Base = require('./Base');
const WidgetMember = require('./WidgetMember');
class Widget extends Base {
  constructor(client, data) {
    super(client);
    this._patch(data);
  }
  _patch(data) {
    this.id = data.id;
    if ('name' in data) {
      this.name = data.name;
    }
    if ('instant_invite' in data) {
      this.instantInvite = data.instant_invite;
    }
    this.channels = new Collection();
    for (const channel of data.channels) {
      this.channels.set(channel.id, channel);
    }
    this.members = new Collection();
    for (const member of data.members) {
      this.members.set(member.id, new WidgetMember(this.client, member));
    }
    if ('presence_count' in data) {
      this.presenceCount = data.presence_count;
    }
  }
  async fetch() {
    const data = await this.client.api.guilds(this.id, 'widget.json').get();
    this._patch(data);
    return this;
  }
}
module.exports = Widget;
