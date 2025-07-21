'use strict';
const Interaction = require('./Interaction');
const InteractionWebhook = require('./InteractionWebhook');
const ModalSubmitFieldsResolver = require('./ModalSubmitFieldsResolver');
const InteractionResponses = require('./interfaces/InteractionResponses');
const { MessageComponentTypes } = require('../util/Constants');
class ModalSubmitInteraction extends Interaction {
  constructor(client, data) {
    super(client, data);
    this.customId = data.data.custom_id;
    this.components =
      data.data.components?.map(c => ({
        type: MessageComponentTypes[c.type],
        components: ModalSubmitInteraction.transformComponent(c),
      })) ?? [];
    this.message = data.message ? (this.channel?.messages._add(data.message) ?? data.message) : null;
    this.fields = new ModalSubmitFieldsResolver(this.components);
    this.deferred = false;
    this.ephemeral = null;
    this.replied = false;
    this.webhook = new InteractionWebhook(this.client, this.applicationId, this.token);
  }
  static transformComponent(rawComponent) {
    return rawComponent.components.map(c => ({
      value: c.value,
      type: MessageComponentTypes[c.type],
      customId: c.custom_id,
    }));
  }
  isFromMessage() {
    return Boolean(this.message);
  }
  deferReply() {}
  reply() {}
  fetchReply() {}
  editReply() {}
  deleteReply() {}
  followUp() {}
  update() {}
  deferUpdate() {}
}
InteractionResponses.applyToClass(ModalSubmitInteraction, ['showModal', 'awaitModalSubmit']);
module.exports = ModalSubmitInteraction;
