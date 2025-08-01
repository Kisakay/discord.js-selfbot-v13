'use strict';
const { Events, Status } = require('../../../util/Constants');
module.exports = (client, packet, shard) => {
  const channel = client.channels.cache.get(packet.d.channel_id);
  if (channel) {
    if (!channel._recipients) channel._recipients = [];
    channel._recipients.push(packet.d.user);
    const user = client.users._add(packet.d.user);
    if (shard.status == Status.READY) {
      client.emit(Events.CHANNEL_RECIPIENT_ADD, channel, user);
    }
  }
};
