'use strict';
const { Events } = require('../../../util/Constants');
module.exports = (client, packet) => {
  const channel = client.channels.cache.get(packet.d.channel_id);
  if (channel) {
    if (!channel._recipients) channel._recipients = [];
    channel._recipients = channel._recipients.filter(u => u.id !== packet.d.user.id);
    client.emit(Events.CHANNEL_RECIPIENT_REMOVE, channel, client.users._add(packet.d.user));
  }
};
