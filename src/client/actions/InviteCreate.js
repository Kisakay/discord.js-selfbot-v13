'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class InviteCreateAction extends Action {
  handle(data) {
    const client = this.client;
    const channel = client.channels.cache.get(data.channel_id);
    const guild = client.guilds.cache.get(data.guild_id);
    if (!channel) return false;
    const inviteData = Object.assign(data, { channel, guild });
    const invite = guild.invites._add(inviteData);
    client.emit(Events.INVITE_CREATE, invite);
    return { invite };
  }
}
module.exports = InviteCreateAction;
