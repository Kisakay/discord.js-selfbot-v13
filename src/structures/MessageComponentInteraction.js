'use strict';
const Interaction = require('./Interaction');
const InteractionWebhook = require('./InteractionWebhook');
const InteractionResponses = require('./interfaces/InteractionResponses');
const { MessageComponentTypes } = require('../util/Constants');
class MessageComponentInteraction extends Interaction {
  constructor(client, data) {
    super(client, data);
    this.message = this.channel?.messages._add(data.message) ?? data.message;
    this.customId = data.data.custom_id;
    this.componentType = MessageComponentInteraction.resolveType(data.data.component_type);
    this.deferred = false;
    this.ephemeral = null;
    this.replied = false;
    this.webhook = new InteractionWebhook(this.client, this.applicationId, this.token);
  }
  get component() {
    return this.message.components
      .flatMap(row => row.components)
      .find(component => (component.customId ?? component.custom_id) === this.customId);
  }
  static resolveType(type) {
    return typeof type === 'string' ? type : MessageComponentTypes[type];
  }
  deferReply() {}
  reply() {}
  fetchReply() {}
  editReply() {}
  deleteReply() {}
  followUp() {}
  deferUpdate() {}
  update() {}
  showModal() {}
  awaitModalSubmit() {}
}
InteractionResponses.applyToClass(MessageComponentInteraction);
module.exports = MessageComponentInteraction;
