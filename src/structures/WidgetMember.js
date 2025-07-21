'use strict';
const Base = require('./Base');
class WidgetMember extends Base {
  constructor(client, data) {
    super(client);
    this.id = data.id;
    this.username = data.username;
    this.discriminator = data.discriminator;
    this.avatar = data.avatar;
    this.status = data.status;
    this.deaf = data.deaf ?? null;
    this.mute = data.mute ?? null;
    this.selfDeaf = data.self_deaf ?? null;
    this.selfMute = data.self_mute ?? null;
    this.suppress = data.suppress ?? null;
    this.channelId = data.channel_id ?? null;
    this.avatarURL = data.avatar_url;
    this.activity = data.activity ?? null;
  }
}
module.exports = WidgetMember;
