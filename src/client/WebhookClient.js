'use strict';
const BaseClient = require('./BaseClient');
const { Error } = require('../errors');
const Webhook = require('../structures/Webhook');
class WebhookClient extends BaseClient {
  constructor(data, options) {
    super(options);
    Object.defineProperty(this, 'client', { value: this });
    let { id, token } = data;
    if ('url' in data) {
      const url = data.url.match(
        /^https?:\/\/(?:canary|ptb)?\.?discord\.com\/api\/webhooks(?:\/v[0-9]\d*)?\/([^\/]+)\/([^\/]+)/i,
      );
      if (!url || url.length <= 1) throw new Error('WEBHOOK_URL_INVALID');
      [, id, token] = url;
    }
    this.id = id;
    Object.defineProperty(this, 'token', { value: token, writable: true, configurable: true });
  }
  send() {}
  sendSlackMessage() {}
  fetchMessage() {}
  edit() {}
  editMessage() {}
  delete() {}
  deleteMessage() {}
  get createdTimestamp() {}
  get createdAt() {}
  get url() {}
}
Webhook.applyToClass(WebhookClient);
module.exports = WebhookClient;
