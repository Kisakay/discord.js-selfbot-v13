'use strict';
const MessageCollector = require('../MessageCollector');
const MessagePayload = require('../MessagePayload');
const { InteractionTypes, ApplicationCommandOptionTypes, Events } = require('../../util/Constants');
const { Error } = require('../../errors');
const SnowflakeUtil = require('../../util/SnowflakeUtil');
const { setTimeout } = require('node:timers');
const { s } = require('@sapphire/shapeshift');
const Util = require('../../util/Util');
const validateName = stringName =>
  s.string
    .lengthGreaterThanOrEqual(1)
    .lengthLessThanOrEqual(32)
    .regex(/^[\p{Ll}\p{Lm}\p{Lo}\p{N}\p{sc=Devanagari}\p{sc=Thai}_-]+$/u)
    .setValidationEnabled(true)
    .parse(stringName);
class TextBasedChannel {
  constructor() {
    this.messages = new MessageManager(this);
    this.lastMessageId = null;
    this.lastPinTimestamp = null;
  }
  get lastMessage() {
    return this.messages.resolve(this.lastMessageId);
  }
  get lastPinAt() {
    return this.lastPinTimestamp ? new Date(this.lastPinTimestamp) : null;
  }
  async send(options) {
    const User = require('../User');
    const { GuildMember } = require('../GuildMember');
    if (this instanceof User || this instanceof GuildMember) {
      const dm = await this.createDM();
      return dm.send(options);
    }
    let messagePayload;
    if (options instanceof MessagePayload) {
      messagePayload = options.resolveData();
    } else {
      messagePayload = MessagePayload.create(this, options).resolveData();
    }
    const { data, files } = await messagePayload.resolveFiles();
    const attachments = await Util.getUploadURL(this.client, this.id, files);
    const requestPromises = attachments.map(async attachment => {
      await Util.uploadFile(files[attachment.id].file, attachment.upload_url);
      return {
        id: attachment.id,
        filename: files[attachment.id].name,
        uploaded_filename: attachment.upload_filename,
        description: files[attachment.id].description,
        duration_secs: files[attachment.id].duration_secs,
        waveform: files[attachment.id].waveform,
      };
    });
    const attachmentsData = await Promise.all(requestPromises);
    attachmentsData.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    data.attachments = attachmentsData;
    const d = await this.client.api.channels[this.id].messages.post({ data });
    return this.messages.cache.get(d.id) ?? this.messages._add(d);
  }
  searchInteractionFromGuildAndPrivateChannel() {
    return this.client.api[this.guild ? 'guilds' : 'channels'][this.guild?.id || this.id]['application-command-index']
      .get()
      .catch(() => ({
        application_commands: [],
        applications: [],
        version: '',
      }));
  }
  searchInteractionUserApps() {
    return this.client.api.users['@me']['application-command-index'].get().catch(() => ({
      application_commands: [],
      applications: [],
      version: '',
    }));
  }
  searchInteraction() {
    return Promise.all([this.searchInteractionFromGuildAndPrivateChannel(), this.searchInteractionUserApps()]).then(
      ([dataA, dataB]) => ({
        applications: [...dataA.applications, ...dataB.applications],
        application_commands: [...dataA.application_commands, ...dataB.application_commands],
      }),
    );
  }
  async sendSlash(botOrApplicationId, commandNameString, ...args) {
    const cmd = commandNameString.trim().split(' ');
    const commandName = validateName(cmd[0]);
    const sub = cmd.slice(1);
    for (let i = 0; i < sub.length; i++) {
      if (sub.length > 2) {
        throw new Error('INVALID_COMMAND_NAME', cmd);
      }
      validateName(sub[i]);
    }
    const data = await this.searchInteraction();
    const filterCommand = data.application_commands.filter(obj =>
      [obj.name, obj.name_default].includes(commandName),
    );
    botOrApplicationId = this.client.users.resolveId(botOrApplicationId);
    const application = data.applications.find(
      obj => obj.id == botOrApplicationId || obj.bot?.id == botOrApplicationId,
    );
    if (!application) {
      throw new Error('INVALID_APPLICATION_COMMAND', "Bot/Application doesn't exist");
    }
    const command = filterCommand.find(command => command.application_id == application.id);
    if (!command) {
      throw new Error('INVALID_APPLICATION_COMMAND', application.id);
    }
    args = args.flat(2);
    let optionFormat = [];
    let attachments = [];
    let optionsMaxdepth, subGroup, subCommand;
    if (sub.length == 2) {
      subGroup = command.options.find(
        obj =>
          obj.type == ApplicationCommandOptionTypes.SUB_COMMAND_GROUP && [obj.name, obj.name_default].includes(sub[0]),
      );
      if (!subGroup) throw new Error('SLASH_COMMAND_SUB_COMMAND_GROUP_INVALID', sub[0]);
      subCommand = subGroup.options.find(
        obj => obj.type == ApplicationCommandOptionTypes.SUB_COMMAND && [obj.name, obj.name_default].includes(sub[1]),
      );
      if (!subCommand) throw new Error('SLASH_COMMAND_SUB_COMMAND_INVALID', sub[1]);
      optionsMaxdepth = subCommand.options;
    } else if (sub.length == 1) {
      subCommand = command.options.find(
        obj => obj.type == ApplicationCommandOptionTypes.SUB_COMMAND && [obj.name, obj.name_default].includes(sub[0]),
      );
      if (!subCommand) throw new Error('SLASH_COMMAND_SUB_COMMAND_INVALID', sub[0]);
      optionsMaxdepth = subCommand.options;
    } else {
      optionsMaxdepth = command.options;
    }
    const valueRequired = optionsMaxdepth?.filter(o => o.required).length || 0;
    for (let i = 0; i < Math.min(args.length, optionsMaxdepth?.length || 0); i++) {
      const optionInput = optionsMaxdepth[i];
      const value = args[i];
      const parseData = await parseOption(
        this.client,
        optionInput,
        value,
        optionFormat,
        attachments,
        command,
        application.id,
        this.guild?.id,
        this.id,
        subGroup,
        subCommand,
      );
      optionFormat = parseData.optionFormat;
      attachments = parseData.attachments;
    }
    if (valueRequired > args.length) {
      throw new Error('SLASH_COMMAND_REQUIRED_OPTIONS_MISSING', valueRequired, optionFormat.length);
    }
    let postData;
    if (subGroup) {
      postData = [
        {
          type: ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
          name: subGroup.name,
          options: [
            {
              type: ApplicationCommandOptionTypes.SUB_COMMAND,
              name: subCommand.name,
              options: optionFormat,
            },
          ],
        },
      ];
    } else if (subCommand) {
      postData = [
        {
          type: ApplicationCommandOptionTypes.SUB_COMMAND,
          name: subCommand.name,
          options: optionFormat,
        },
      ];
    } else {
      postData = optionFormat;
    }
    const nonce = SnowflakeUtil.generate();
    const body = createPostData(
      this.client,
      false,
      application.id,
      nonce,
      this.guild?.id,
      Boolean(command.guild_id),
      this.id,
      command.version,
      command.id,
      command.name_default || command.name,
      command.type,
      postData,
      attachments,
    );
    this.client.api.interactions.post({
      data: body,
      usePayloadJSON: true,
    });
    return Util.createPromiseInteraction(this.client, nonce, 5000);
  }
  sendTyping() {
    return this.client.api.channels(this.id).typing.post();
  }
  createMessageCollector(options = {}) {
    return new MessageCollector(this, options);
  }
  awaitMessages(options = {}) {
    return new Promise((resolve, reject) => {
      const collector = this.createMessageCollector(options);
      collector.once('end', (collection, reason) => {
        if (options.errors?.includes(reason)) {
          reject(collection);
        } else {
          resolve(collection);
        }
      });
    });
  }
  fetchWebhooks() {
    return this.guild.channels.fetchWebhooks(this.id);
  }
  createWebhook(name, options = {}) {
    return this.guild.channels.createWebhook(this.id, name, options);
  }
  setRateLimitPerUser(rateLimitPerUser, reason) {
    return this.edit({ rateLimitPerUser }, reason);
  }
  setNSFW(nsfw = true, reason) {
    return this.edit({ nsfw }, reason);
  }
  static applyToClass(structure, full = false, ignore = []) {
    const props = ['send'];
    if (full) {
      props.push(
        'sendSlash',
        'searchInteraction',
        'searchInteractionFromGuildAndPrivateChannel',
        'searchInteractionUserApps',
        'lastMessage',
        'lastPinAt',
        'sendTyping',
        'createMessageCollector',
        'awaitMessages',
        'fetchWebhooks',
        'createWebhook',
        'setRateLimitPerUser',
        'setNSFW',
      );
    }
    for (const prop of props) {
      if (ignore.includes(prop)) continue;
      Object.defineProperty(
        structure.prototype,
        prop,
        Object.getOwnPropertyDescriptor(TextBasedChannel.prototype, prop),
      );
    }
  }
}
module.exports = TextBasedChannel;
const MessageManager = require('../../managers/MessageManager');
function parseChoices(parent, list_choices, value) {
  if (value !== undefined) {
    if (Array.isArray(list_choices) && list_choices.length) {
      const choice = list_choices.find(c => [c.name, c.value].includes(value));
      if (choice) {
        return choice.value;
      } else {
        throw new Error('INVALID_SLASH_COMMAND_CHOICES', parent, value);
      }
    } else {
      return value;
    }
  } else {
    return undefined;
  }
}
async function addDataFromAttachment(value, client, channelId, attachments) {
  value = await MessagePayload.resolveFile(value);
  if (!value?.file) {
    throw new TypeError('The attachment data must be a BufferResolvable or Stream or FileOptions of MessageAttachment');
  }
  const data = await Util.getUploadURL(client, channelId, [value]);
  await Util.uploadFile(value.file, data[0].upload_url);
  const id = attachments.length;
  attachments.push({
    id,
    filename: value.name,
    uploaded_filename: data[0].upload_filename,
  });
  return {
    id,
    attachments,
  };
}
async function parseOption(
  client,
  optionCommand,
  value,
  optionFormat,
  attachments,
  command,
  applicationId,
  guildId,
  channelId,
  subGroup,
  subCommand,
) {
  const data = {
    type: optionCommand.type,
    name: optionCommand.name,
  };
  if (value !== undefined) {
    switch (optionCommand.type) {
      case ApplicationCommandOptionTypes.BOOLEAN:
      case 'BOOLEAN': {
        data.value = Boolean(value);
        break;
      }
      case ApplicationCommandOptionTypes.INTEGER:
      case 'INTEGER': {
        data.value = Number(value);
        break;
      }
      case ApplicationCommandOptionTypes.ATTACHMENT:
      case 'ATTACHMENT': {
        const parseData = await addDataFromAttachment(value, client, channelId, attachments);
        data.value = parseData.id;
        attachments = parseData.attachments;
        break;
      }
      case ApplicationCommandOptionTypes.SUB_COMMAND_GROUP:
      case 'SUB_COMMAND_GROUP': {
        break;
      }
      default: {
        value = parseChoices(optionCommand.name, optionCommand.choices, value);
        if (optionCommand.autocomplete) {
          const nonce = SnowflakeUtil.generate();
          let postData;
          if (subGroup) {
            postData = [
              {
                type: ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                name: subGroup.name,
                options: [
                  {
                    type: ApplicationCommandOptionTypes.SUB_COMMAND,
                    name: subCommand.name,
                    options: [
                      {
                        type: optionCommand.type,
                        name: optionCommand.name,
                        value,
                        focused: true,
                      },
                    ],
                  },
                ],
              },
            ];
          } else if (subCommand) {
            postData = [
              {
                type: ApplicationCommandOptionTypes.SUB_COMMAND,
                name: subCommand.name,
                options: [
                  {
                    type: optionCommand.type,
                    name: optionCommand.name,
                    value,
                    focused: true,
                  },
                ],
              },
            ];
          } else {
            postData = [
              {
                type: optionCommand.type,
                name: optionCommand.name,
                value,
                focused: true,
              },
            ];
          }
          const body = createPostData(
            client,
            true,
            applicationId,
            nonce,
            guildId,
            Boolean(command.guild_id),
            channelId,
            command.version,
            command.id,
            command.name_default || command.name,
            command.type,
            postData,
            [],
          );
          await client.api.interactions.post({
            data: body,
          });
          data.value = await awaitAutocomplete(client, nonce, value);
        } else {
          data.value = value;
        }
      }
    }
    optionFormat.push(data);
  }
  return {
    optionFormat,
    attachments,
  };
}
function awaitAutocomplete(client, nonce, defaultValue) {
  return new Promise(resolve => {
    const handler = data => {
      if (data.t !== 'APPLICATION_COMMAND_AUTOCOMPLETE_RESPONSE') return;
      if (data.d?.nonce !== nonce) return;
      clearTimeout(timeout);
      client.removeListener(Events.UNHANDLED_PACKET, handler);
      client.decrementMaxListeners();
      if (data.d.choices.length >= 1) {
        resolve(data.d.choices[0].value);
      } else {
        resolve(defaultValue);
      }
    };
    const timeout = setTimeout(() => {
      client.removeListener(Events.UNHANDLED_PACKET, handler);
      client.decrementMaxListeners();
      resolve(defaultValue);
    }, 5_000).unref();
    client.incrementMaxListeners();
    client.on(Events.UNHANDLED_PACKET, handler);
  });
}
function createPostData(
  client,
  isAutocomplete = false,
  applicationId,
  nonce,
  guildId,
  isGuildCommand,
  channelId,
  commandVersion,
  commandId,
  commandName,
  commandType,
  postData,
  attachments = [],
) {
  const data = {
    type: isAutocomplete ? InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE : InteractionTypes.APPLICATION_COMMAND,
    application_id: applicationId,
    guild_id: guildId,
    channel_id: channelId,
    session_id: client.sessionId,
    data: {
      version: commandVersion,
      id: commandId,
      name: commandName,
      type: commandType,
      options: postData,
      attachments: attachments,
    },
    nonce,
  };
  if (isGuildCommand) {
    data.data.guild_id = guildId;
  }
  return data;
}
