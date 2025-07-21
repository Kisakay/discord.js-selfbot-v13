'use strict';
const { TypeError } = require('../errors');
const { MessageComponentTypes } = require('../util/Constants');
class ModalSubmitFieldsResolver {
  constructor(components) {
    this.components = components;
  }
  get _fields() {
    return this.components.reduce((previous, next) => previous.concat(next.components), []);
  }
  getField(customId) {
    const field = this._fields.find(f => f.customId === customId);
    if (!field) throw new TypeError('MODAL_SUBMIT_INTERACTION_FIELD_NOT_FOUND', customId);
    return field;
  }
  getTextInputValue(customId) {
    const field = this.getField(customId);
    const expectedType = MessageComponentTypes[MessageComponentTypes.TEXT_INPUT];
    if (field.type !== expectedType) {
      throw new TypeError('MODAL_SUBMIT_INTERACTION_FIELD_TYPE', customId, field.type, expectedType);
    }
    return field.value;
  }
}
module.exports = ModalSubmitFieldsResolver;
