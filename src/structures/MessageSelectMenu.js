'use strict';
const BaseMessageComponent = require('./BaseMessageComponent');
const { ChannelTypes, MessageComponentTypes } = require('../util/Constants');
const Util = require('../util/Util');
class MessageSelectMenu extends BaseMessageComponent {
  constructor(data = {}) {
    super({ type: BaseMessageComponent.resolveType(data.type) ?? 'STRING_SELECT' });
    this.setup(data);
  }
  setup(data) {
    this.customId = data.custom_id ?? data.customId ?? null;
    this.placeholder = data.placeholder ?? null;
    this.minValues = data.min_values ?? data.minValues ?? null;
    this.maxValues = data.max_values ?? data.maxValues ?? null;
    this.options = this.constructor.normalizeOptions(data.options ?? []);
    this.disabled = data.disabled ?? false;
    this.channelTypes =
      data.channel_types?.map(channelType =>
        typeof channelType === 'string' ? channelType : ChannelTypes[channelType],
      ) ?? [];
  }
  toJSON() {
    return {
      channel_types: this.channelTypes.map(type => (typeof type === 'string' ? ChannelTypes[type] : type)),
      custom_id: this.customId,
      disabled: this.disabled,
      placeholder: this.placeholder,
      min_values: this.minValues,
      max_values: this.maxValues ?? (this.minValues ? this.options.length : undefined),
      options: this.options,
      type: typeof this.type === 'string' ? MessageComponentTypes[this.type] : this.type,
    };
  }
  static normalizeOption(option) {
    let { label, value, description, emoji } = option;
    label = Util.verifyString(label, RangeError, 'SELECT_OPTION_LABEL');
    value = Util.verifyString(value, RangeError, 'SELECT_OPTION_VALUE');
    emoji = emoji ? Util.resolvePartialEmoji(emoji) : null;
    description = description ? Util.verifyString(description, RangeError, 'SELECT_OPTION_DESCRIPTION', true) : null;
    return { label, value, description, emoji, default: option.default ?? false };
  }
  static normalizeOptions(...options) {
    return options.flat(Infinity).map(option => this.normalizeOption(option));
  }
}
module.exports = MessageSelectMenu;
