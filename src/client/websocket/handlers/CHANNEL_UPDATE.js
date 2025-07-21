'use strict';
const { Events } = require('../../../util/Constants');
module.exports = (client, packet) => {
  const { old, updated } = client.actions.ChannelUpdate.handle(packet.d);
  if (old && updated) {
    client.emit(Events.CHANNEL_UPDATE, old, updated);
  }
};
