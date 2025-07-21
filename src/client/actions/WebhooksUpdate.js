'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class WebhooksUpdate extends Action {
  handle(data) {
    const client = this.client;
    const channel = client.channels.cache.get(data.channel_id);
    if (channel) client.emit(Events.WEBHOOKS_UPDATE, channel);
  }
}
module.exports = WebhooksUpdate;
