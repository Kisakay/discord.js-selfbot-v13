'use strict';
const { Collection } = require('@discordjs/collection');
const Interaction = require('./Interaction');
const InteractionWebhook = require('./InteractionWebhook');
const MessageAttachment = require('./MessageAttachment');
const InteractionResponses = require('./interfaces/InteractionResponses');
const { ApplicationCommandOptionTypes } = require('../util/Constants');
class BaseCommandInteraction extends Interaction {
  constructor(client, data) {
    super(client, data);
    this.commandId = data.data.id;
    this.commandName = data.data.name;
    this.deferred = false;
    this.replied = false;
    this.ephemeral = null;
    this.webhook = new InteractionWebhook(this.client, this.applicationId, this.token);
  }
  get command() {
    const id = this.commandId;
    return this.guild?.commands.cache.get(id) ?? this.client.application.commands.cache.get(id) ?? null;
  }
  transformResolved({ members, users, channels, roles, messages, attachments }) {
    const result = {};
    if (members) {
      result.members = new Collection();
      for (const [id, member] of Object.entries(members)) {
        const user = users[id];
        result.members.set(id, this.guild?.members._add({ user, ...member }) ?? member);
      }
    }
    if (users) {
      result.users = new Collection();
      for (const user of Object.values(users)) {
        result.users.set(user.id, this.client.users._add(user));
      }
    }
    if (roles) {
      result.roles = new Collection();
      for (const role of Object.values(roles)) {
        result.roles.set(role.id, this.guild?.roles._add(role) ?? role);
      }
    }
    if (channels) {
      result.channels = new Collection();
      for (const channel of Object.values(channels)) {
        result.channels.set(channel.id, this.client.channels._add(channel, this.guild) ?? channel);
      }
    }
    if (messages) {
      result.messages = new Collection();
      for (const message of Object.values(messages)) {
        result.messages.set(message.id, this.channel?.messages?._add(message) ?? message);
      }
    }
    if (attachments) {
      result.attachments = new Collection();
      for (const attachment of Object.values(attachments)) {
        const patched = new MessageAttachment(attachment.url, attachment.filename, attachment);
        result.attachments.set(attachment.id, patched);
      }
    }
    return result;
  }
  transformOption(option, resolved) {
    const result = {
      name: option.name,
      type: ApplicationCommandOptionTypes[option.type],
    };
    if ('value' in option) result.value = option.value;
    if ('options' in option) result.options = option.options.map(opt => this.transformOption(opt, resolved));
    if (resolved) {
      const user = resolved.users?.[option.value];
      if (user) result.user = this.client.users._add(user);
      const member = resolved.members?.[option.value];
      if (member) result.member = this.guild?.members._add({ user, ...member }) ?? member;
      const channel = resolved.channels?.[option.value];
      if (channel) result.channel = this.client.channels._add(channel, this.guild) ?? channel;
      const role = resolved.roles?.[option.value];
      if (role) result.role = this.guild?.roles._add(role) ?? role;
      const attachment = resolved.attachments?.[option.value];
      if (attachment) result.attachment = new MessageAttachment(attachment.url, attachment.filename, attachment);
    }
    return result;
  }
  deferReply() {}
  reply() {}
  fetchReply() {}
  editReply() {}
  deleteReply() {}
  followUp() {}
  showModal() {}
  awaitModalSubmit() {}
}
InteractionResponses.applyToClass(BaseCommandInteraction, ['deferUpdate', 'update']);
module.exports = BaseCommandInteraction;
