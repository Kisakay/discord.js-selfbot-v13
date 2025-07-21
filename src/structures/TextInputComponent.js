'use strict';
const BaseMessageComponent = require('./BaseMessageComponent');
const { RangeError } = require('../errors');
const { TextInputStyles, MessageComponentTypes } = require('../util/Constants');
const Util = require('../util/Util');
class TextInputComponent extends BaseMessageComponent {
  constructor(data = {}) {
    super({ type: 'TEXT_INPUT' });
    this.setup(data);
  }
  setup(data) {
    this.customId = data.custom_id ?? data.customId ?? null;
    this.label = data.label ?? null;
    this.maxLength = data.max_length ?? data.maxLength ?? null;
    this.minLength = data.min_length ?? data.minLength ?? null;
    this.placeholder = data.placeholder ?? null;
    this.required = data.required ?? false;
    this.style = data.style ? TextInputComponent.resolveStyle(data.style) : null;
    this.value = data.value ?? null;
  }
  setValue(value) {
    this.value = Util.verifyString(value, RangeError, 'TEXT_INPUT_VALUE');
    return this;
  }
  toJSON() {
    return {
      custom_id: this.customId,
      label: this.label,
      max_length: this.maxLength,
      min_length: this.minLength,
      placeholder: this.placeholder,
      required: this.required,
      style: TextInputStyles[this.style],
      type: MessageComponentTypes[this.type],
      value: this.value,
    };
  }
  static resolveStyle(style) {
    return typeof style === 'string' ? style : TextInputStyles[style];
  }
}
module.exports = TextInputComponent;
