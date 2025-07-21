'use strict';
const { Events } = require('../../../util/Constants');
module.exports = (client, packet) => {
  const { old, updated } = client.actions.MessageUpdate.handle(packet.d);
  if (old && updated) {
    client.emit(Events.MESSAGE_UPDATE, old, updated);
  }
};
