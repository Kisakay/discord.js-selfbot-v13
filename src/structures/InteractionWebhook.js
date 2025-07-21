'use strict';
const Webhook = require('./Webhook');
class InteractionWebhook {
  constructor(client, id, token) {
    Object.defineProperty(this, 'client', { value: client });
    this.id = id;
    Object.defineProperty(this, 'token', { value: token, writable: true, configurable: true });
  }
  send() {}
  fetchMessage() {}
  editMessage() {}
  deleteMessage() {}
  get url() {}
}
Webhook.applyToClass(InteractionWebhook, ['sendSlackMessage', 'edit', 'delete', 'createdTimestamp', 'createdAt']);
module.exports = InteractionWebhook;
