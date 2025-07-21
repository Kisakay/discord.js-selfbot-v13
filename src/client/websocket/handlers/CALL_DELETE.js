'use strict';
const CallState = require('../../../structures/CallState');
const { Events } = require('../../../util/Constants');
module.exports = (client, packet) => {
  client.emit(Events.CALL_DELETE, new CallState(client, packet.d));
};
