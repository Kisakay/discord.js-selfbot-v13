'use strict';
const Base = require('./Base');
const { InteractionTypes, MessageComponentTypes, ApplicationCommandTypes } = require('../util/Constants');
const Permissions = require('../util/Permissions');
const SnowflakeUtil = require('../util/SnowflakeUtil');
class Interaction extends Base {
  constructor(client, data) {
    super(client);
    this.type = InteractionTypes[data.type];
    this.id = data.id;
    Object.defineProperty(this, 'token', { value: data.token });
    this.applicationId = data.application_id;
    this.channelId = data.channel_id ?? null;
    this.guildId = data.guild_id ?? null;
    this.user = this.client.users._add(data.user ?? data.member.user);
    this.member = data.member ? (this.guild?.members._add(data.member) ?? data.member) : null;
    this.version = data.version;
    this.appPermissions = data.app_permissions ? new Permissions(data.app_permissions).freeze() : null;
    this.memberPermissions = data.member?.permissions ? new Permissions(data.member.permissions).freeze() : null;
    this.locale = data.locale;
    this.guildLocale = data.guild_locale ?? null;
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  get channel() {
    return this.client.channels.cache.get(this.channelId) ?? null;
  }
  get guild() {
    return this.client.guilds.cache.get(this.guildId) ?? null;
  }
  inGuild() {
    return Boolean(this.guildId && this.member);
  }
  inCachedGuild() {
    return Boolean(this.guild && this.member);
  }
  inRawGuild() {
    return Boolean(this.guildId && !this.guild && this.member);
  }
  isApplicationCommand() {
    return InteractionTypes[this.type] === InteractionTypes.APPLICATION_COMMAND;
  }
  isCommand() {
    return InteractionTypes[this.type] === InteractionTypes.APPLICATION_COMMAND && typeof this.targetId === 'undefined';
  }
  isContextMenu() {
    return InteractionTypes[this.type] === InteractionTypes.APPLICATION_COMMAND && typeof this.targetId !== 'undefined';
  }
  isModalSubmit() {
    return InteractionTypes[this.type] === InteractionTypes.MODAL_SUBMIT;
  }
  isUserContextMenu() {
    return this.isContextMenu() && ApplicationCommandTypes[this.targetType] === ApplicationCommandTypes.USER;
  }
  isMessageContextMenu() {
    return this.isContextMenu() && ApplicationCommandTypes[this.targetType] === ApplicationCommandTypes.MESSAGE;
  }
  isAutocomplete() {
    return InteractionTypes[this.type] === InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE;
  }
  isMessageComponent() {
    return InteractionTypes[this.type] === InteractionTypes.MESSAGE_COMPONENT;
  }
  isButton() {
    return (
      InteractionTypes[this.type] === InteractionTypes.MESSAGE_COMPONENT &&
      MessageComponentTypes[this.componentType] === MessageComponentTypes.BUTTON
    );
  }
  isSelectMenu() {
    return (
      InteractionTypes[this.type] === InteractionTypes.MESSAGE_COMPONENT &&
      MessageComponentTypes[this.componentType] === MessageComponentTypes.SELECT_MENU
    );
  }
  isRepliable() {
    return ![InteractionTypes.PING, InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE].includes(
      InteractionTypes[this.type],
    );
  }
}
module.exports = Interaction;
