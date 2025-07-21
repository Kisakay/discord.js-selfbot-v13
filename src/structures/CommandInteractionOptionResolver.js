'use strict';
const { TypeError } = require('../errors');
class CommandInteractionOptionResolver {
  constructor(client, options, resolved) {
    Object.defineProperty(this, 'client', { value: client });
    this._group = null;
    this._subcommand = null;
    this._hoistedOptions = options;
    if (this._hoistedOptions[0]?.type === 'SUB_COMMAND_GROUP') {
      this._group = this._hoistedOptions[0].name;
      this._hoistedOptions = this._hoistedOptions[0].options ?? [];
    }
    if (this._hoistedOptions[0]?.type === 'SUB_COMMAND') {
      this._subcommand = this._hoistedOptions[0].name;
      this._hoistedOptions = this._hoistedOptions[0].options ?? [];
    }
    Object.defineProperty(this, 'data', { value: Object.freeze([...options]) });
    Object.defineProperty(this, 'resolved', { value: Object.freeze(resolved) });
  }
  get(name, required = false) {
    const option = this._hoistedOptions.find(opt => opt.name === name);
    if (!option) {
      if (required) {
        throw new TypeError('COMMAND_INTERACTION_OPTION_NOT_FOUND', name);
      }
      return null;
    }
    return option;
  }
  _getTypedOption(name, type, properties, required) {
    const option = this.get(name, required);
    if (!option) {
      return null;
    } else if (option.type !== type) {
      throw new TypeError('COMMAND_INTERACTION_OPTION_TYPE', name, option.type, type);
    } else if (required && properties.every(prop => option[prop] === null || typeof option[prop] === 'undefined')) {
      throw new TypeError('COMMAND_INTERACTION_OPTION_EMPTY', name, option.type);
    }
    return option;
  }
  getSubcommand(required = true) {
    if (required && !this._subcommand) {
      throw new TypeError('COMMAND_INTERACTION_OPTION_NO_SUB_COMMAND');
    }
    return this._subcommand;
  }
  getSubcommandGroup(required = true) {
    if (required && !this._group) {
      throw new TypeError('COMMAND_INTERACTION_OPTION_NO_SUB_COMMAND_GROUP');
    }
    return this._group;
  }
  getBoolean(name, required = false) {
    const option = this._getTypedOption(name, 'BOOLEAN', ['value'], required);
    return option?.value ?? null;
  }
  getChannel(name, required = false) {
    const option = this._getTypedOption(name, 'CHANNEL', ['channel'], required);
    return option?.channel ?? null;
  }
  getString(name, required = false) {
    const option = this._getTypedOption(name, 'STRING', ['value'], required);
    return option?.value ?? null;
  }
  getInteger(name, required = false) {
    const option = this._getTypedOption(name, 'INTEGER', ['value'], required);
    return option?.value ?? null;
  }
  getNumber(name, required = false) {
    const option = this._getTypedOption(name, 'NUMBER', ['value'], required);
    return option?.value ?? null;
  }
  getUser(name, required = false) {
    const option = this._getTypedOption(name, 'USER', ['user'], required);
    return option?.user ?? null;
  }
  getMember(name, required = false) {
    const option = this._getTypedOption(name, 'USER', ['member'], required);
    return option?.member ?? null;
  }
  getRole(name, required = false) {
    const option = this._getTypedOption(name, 'ROLE', ['role'], required);
    return option?.role ?? null;
  }
  getMentionable(name, required = false) {
    const option = this._getTypedOption(name, 'MENTIONABLE', ['user', 'member', 'role'], required);
    return option?.member ?? option?.user ?? option?.role ?? null;
  }
  getMessage(name, required = false) {
    const option = this._getTypedOption(name, '_MESSAGE', ['message'], required);
    return option?.message ?? null;
  }
  getFocused(getFull = false) {
    const focusedOption = this._hoistedOptions.find(option => option.focused);
    if (!focusedOption) throw new TypeError('AUTOCOMPLETE_INTERACTION_OPTION_NO_FOCUSED_OPTION');
    return getFull ? focusedOption : focusedOption.value;
  }
  getAttachment(name, required = false) {
    const option = this._getTypedOption(name, 'ATTACHMENT', ['attachment'], required);
    return option?.attachment ?? null;
  }
}
module.exports = CommandInteractionOptionResolver;
