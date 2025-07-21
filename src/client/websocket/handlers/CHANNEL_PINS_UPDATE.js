'use strict';
const { Events } = require('../../../util/Constants');
module.exports = (client, { d: data }) => {
  const channel = client.channels.cache.get(data.channel_id);
  const time = data.last_pin_timestamp ? new Date(data.last_pin_timestamp).getTime() : null;
  if (channel) {
    channel.lastPinTimestamp = time;
    client.emit(Events.CHANNEL_PINS_UPDATE, channel, time);
  }
};
