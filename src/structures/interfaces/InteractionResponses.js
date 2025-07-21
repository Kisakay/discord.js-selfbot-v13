'use strict';
const { Error } = require('../../errors');
const { InteractionResponseTypes, InteractionTypes } = require('../../util/Constants');
const MessageFlags = require('../../util/MessageFlags');
const InteractionCollector = require('../InteractionCollector');
const MessagePayload = require('../MessagePayload');
const Modal = require('../Modal');
class InteractionResponses {
  async deferReply(options = {}) {
    if (this.deferred || this.replied) throw new Error('INTERACTION_ALREADY_REPLIED');
    this.ephemeral = options.ephemeral ?? false;
    await this.client.api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: options.ephemeral ? MessageFlags.FLAGS.EPHEMERAL : undefined,
        },
      },
      auth: false,
    });
    this.deferred = true;
    return options.fetchReply ? this.fetchReply() : undefined;
  }
  async reply(options) {
    if (this.deferred || this.replied) throw new Error('INTERACTION_ALREADY_REPLIED');
    this.ephemeral = options.ephemeral ?? false;
    let messagePayload;
    if (options instanceof MessagePayload) messagePayload = options;
    else messagePayload = MessagePayload.create(this, options);
    const { data, files } = await messagePayload.resolveData().resolveFiles();
    await this.client.api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.CHANNEL_MESSAGE_WITH_SOURCE,
        data,
      },
      files,
      auth: false,
    });
    this.replied = true;
    return options.fetchReply ? this.fetchReply() : undefined;
  }
  fetchReply(message = '@original') {
    return this.webhook.fetchMessage(message);
  }
  async editReply(options) {
    if (!this.deferred && !this.replied) throw new Error('INTERACTION_NOT_REPLIED');
    const message = await this.webhook.editMessage(options.message ?? '@original', options);
    this.replied = true;
    return message;
  }
  async deleteReply(message = '@original') {
    await this.webhook.deleteMessage(message);
  }
  async followUp(options) {
    if (!this.deferred && !this.replied) throw new Error('INTERACTION_NOT_REPLIED');
    return this.webhook.send(options);
  }
  async deferUpdate(options = {}) {
    if (this.deferred || this.replied) throw new Error('INTERACTION_ALREADY_REPLIED');
    await this.client.api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.DEFERRED_MESSAGE_UPDATE,
      },
      auth: false,
    });
    this.deferred = true;
    return options.fetchReply ? this.fetchReply() : undefined;
  }
  async update(options) {
    if (this.deferred || this.replied) throw new Error('INTERACTION_ALREADY_REPLIED');
    let messagePayload;
    if (options instanceof MessagePayload) messagePayload = options;
    else messagePayload = MessagePayload.create(this, options);
    const { data, files } = await messagePayload.resolveData().resolveFiles();
    await this.client.api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.UPDATE_MESSAGE,
        data,
      },
      files,
      auth: false,
    });
    this.replied = true;
    return options.fetchReply ? this.fetchReply() : undefined;
  }
  async showModal(modal) {
    if (this.deferred || this.replied) throw new Error('INTERACTION_ALREADY_REPLIED');
    const _modal = modal instanceof Modal ? modal : new Modal(modal);
    await this.client.api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.MODAL,
        data: _modal.toJSON(),
      },
    });
    this.replied = true;
  }
  awaitModalSubmit(options) {
    if (typeof options.time !== 'number') throw new Error('INVALID_TYPE', 'time', 'number');
    const _options = { ...options, max: 1, interactionType: InteractionTypes.MODAL_SUBMIT };
    return new Promise((resolve, reject) => {
      const collector = new InteractionCollector(this.client, _options);
      collector.once('end', (interactions, reason) => {
        const interaction = interactions.first();
        if (interaction) resolve(interaction);
        else reject(new Error('INTERACTION_COLLECTOR_ERROR', reason));
      });
    });
  }
  static applyToClass(structure, ignore = []) {
    const props = [
      'deferReply',
      'reply',
      'fetchReply',
      'editReply',
      'deleteReply',
      'followUp',
      'deferUpdate',
      'update',
      'showModal',
      'awaitModalSubmit',
    ];
    for (const prop of props) {
      if (ignore.includes(prop)) continue;
      Object.defineProperty(
        structure.prototype,
        prop,
        Object.getOwnPropertyDescriptor(InteractionResponses.prototype, prop),
      );
    }
  }
}
module.exports = InteractionResponses;
