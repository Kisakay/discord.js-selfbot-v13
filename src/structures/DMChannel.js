'use strict';
const { Collection } = require('@discordjs/collection');
const { Channel } = require('./Channel');
const TextBasedChannel = require('./interfaces/TextBasedChannel');
const MessageManager = require('../managers/MessageManager');
const { Opcodes, Status } = require('../util/Constants');
class DMChannel extends Channel {
  constructor(client, data) {
    super(client, data);
    this.type = 'DM';
    this.messages = new MessageManager(this);
  }
  _patch(data) {
    super._patch(data);
    if (data.recipients) {
      this.recipient = this.client.users._add(data.recipients[0]);
    }
    if ('last_message_id' in data) {
      this.lastMessageId = data.last_message_id;
    }
    if ('last_pin_timestamp' in data) {
      this.lastPinTimestamp = data.last_pin_timestamp ? Date.parse(data.last_pin_timestamp) : null;
    } else {
      this.lastPinTimestamp ??= null;
    }
    if ('is_message_request' in data) {
      this.messageRequest = data.is_message_request;
    }
    if ('is_message_request_timestamp' in data) {
      this.messageRequestTimestamp = data.is_message_request_timestamp
        ? Date.parse(data.is_message_request_timestamp)
        : null;
    }
  }
  async acceptMessageRequest() {
    if (!this.messageRequest) {
      throw new Error('NOT_MESSAGE_REQUEST', 'This channel is not a message request');
    }
    const c = await this.client.api.channels[this.id].recipients['@me'].put({
      data: {
        consent_status: 2,
      },
    });
    this.messageRequest = false;
    return this.client.channels._add(c);
  }
  async cancelMessageRequest() {
    if (!this.messageRequest) {
      throw new Error('NOT_MESSAGE_REQUEST', 'This channel is not a message request');
    }
    await this.client.api.channels[this.id].recipients['@me'].delete();
    return this;
  }
  get partial() {
    return typeof this.lastMessageId === 'undefined';
  }
  fetch(force = true) {
    return this.recipient.createDM(force);
  }
  toString() {
    return this.recipient.toString();
  }
  sync() {
    this.client.ws.broadcast({
      op: Opcodes.DM_UPDATE,
      d: {
        channel_id: this.id,
      },
    });
  }
  ring() {
    return this.client.api.channels(this.id).call.ring.post({
      data: {
        recipients: null,
      },
    });
  }
  get shard() {
    return this.client.ws.shards.first();
  }
  get lastMessage() {}
  get lastPinAt() {}
  send() {}
  sendTyping() {}
  createMessageCollector() {}
  awaitMessages() {}
}
TextBasedChannel.applyToClass(DMChannel, true, ['fetchWebhooks', 'createWebhook', 'setRateLimitPerUser', 'setNSFW']);
module.exports = DMChannel;
