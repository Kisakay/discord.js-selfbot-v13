'use strict';
const process = require('node:process');
const { Collection } = require('@discordjs/collection');
const Base = require('./Base');
const BaseMessageComponent = require('./BaseMessageComponent');
const MessageAttachment = require('./MessageAttachment');
const Embed = require('./MessageEmbed');
const Mentions = require('./MessageMentions');
const MessagePayload = require('./MessagePayload');
const { Poll } = require('./Poll');
const ReactionCollector = require('./ReactionCollector');
const { Sticker } = require('./Sticker');
const Application = require('./interfaces/Application');
const { Error } = require('../errors');
const ReactionManager = require('../managers/ReactionManager');
const {
  InteractionTypes,
  MessageTypes,
  SystemMessageTypes,
  MessageComponentTypes,
  MessageReferenceTypes,
} = require('../util/Constants');
const MessageFlags = require('../util/MessageFlags');
const Permissions = require('../util/Permissions');
const SnowflakeUtil = require('../util/SnowflakeUtil');
const Util = require('../util/Util');
const deletedMessages = new WeakSet();
let deprecationEmittedForDeleted = false;
class Message extends Base {
  constructor(client, data) {
    super(client);
    this.channelId = data.channel_id;
    this.guildId = data.guild_id ?? this.channel?.guild?.id ?? null;
    this._patch(data);
  }
  _patch(data) {
    this.id = data.id;
    if ('position' in data) {
      this.position = data.position;
    } else {
      this.position ??= null;
    }
    this.createdTimestamp = this.id ? SnowflakeUtil.timestampFrom(this.id) : new Date(data.timestamp).getTime();
    if ('type' in data) {
      this.type = MessageTypes[data.type];
      this.system = SystemMessageTypes.includes(this.type);
    } else {
      this.system ??= null;
      this.type ??= null;
    }
    if ('content' in data) {
      this.content = data.content;
    } else {
      this.content ??= null;
    }
    if ('author' in data) {
      this.author = this.client.users._add(data.author, !data.webhook_id);
    } else {
      this.author ??= null;
    }
    if ('pinned' in data) {
      this.pinned = Boolean(data.pinned);
    } else {
      this.pinned ??= null;
    }
    if ('tts' in data) {
      this.tts = data.tts;
    } else {
      this.tts ??= null;
    }
    if ('nonce' in data) {
      this.nonce = data.nonce;
    } else {
      this.nonce ??= null;
    }
    if ('embeds' in data) {
      this.embeds = data.embeds.map(e => new Embed(e, true));
    } else {
      this.embeds = this.embeds?.slice() ?? [];
    }
    if ('components' in data) {
      this.components = data.components.map(c => BaseMessageComponent.create(c, this.client));
    } else {
      this.components = this.components?.slice() ?? [];
    }
    if ('attachments' in data) {
      this.attachments = new Collection();
      if (data.attachments) {
        for (const attachment of data.attachments) {
          this.attachments.set(attachment.id, new MessageAttachment(attachment.url, attachment.filename, attachment));
        }
      }
    } else {
      this.attachments = new Collection(this.attachments);
    }
    if ('sticker_items' in data || 'stickers' in data) {
      this.stickers = new Collection(
        (data.sticker_items ?? data.stickers)?.map(s => [s.id, new Sticker(this.client, s)]),
      );
    } else {
      this.stickers = new Collection(this.stickers);
    }
    if (data.edited_timestamp) {
      this.editedTimestamp = data.edited_timestamp ? Date.parse(data.edited_timestamp) : null;
    } else {
      this.editedTimestamp ??= null;
    }
    if ('reactions' in data) {
      this.reactions = new ReactionManager(this);
      if (data.reactions?.length > 0) {
        for (const reaction of data.reactions) {
          this.reactions._add(reaction);
        }
      }
    } else {
      this.reactions ??= new ReactionManager(this);
    }
    if (!this.mentions) {
      this.mentions = new Mentions(
        this,
        data.mentions,
        data.mention_roles,
        data.mention_everyone,
        data.mention_channels,
        data.referenced_message?.author,
      );
    } else {
      this.mentions = new Mentions(
        this,
        data.mentions ?? this.mentions.users,
        data.mention_roles ?? this.mentions.roles,
        data.mention_everyone ?? this.mentions.everyone,
        data.mention_channels ?? this.mentions.crosspostedChannels,
        data.referenced_message?.author ?? this.mentions.repliedUser,
      );
    }
    if ('webhook_id' in data) {
      this.webhookId = data.webhook_id;
    } else {
      this.webhookId ??= null;
    }
    if (data.poll) {
      this.poll = new Poll(this.client, data.poll, this);
    } else {
      this.poll ??= null;
    }
    if ('application' in data) {
      this.groupActivityApplication = new Application(this.client, data.application);
    } else {
      this.groupActivityApplication ??= null;
    }
    if ('application_id' in data) {
      this.applicationId = data.application_id;
    } else {
      this.applicationId ??= null;
    }
    if ('activity' in data) {
      this.activity = {
        partyId: data.activity.party_id,
        type: data.activity.type,
      };
    } else {
      this.activity ??= null;
    }
    if ('thread' in data) {
      this.client.channels._add(data.thread, this.guild);
    }
    if (this.member && data.member) {
      this.member._patch(data.member);
    } else if (data.member && this.guild && this.author) {
      this.guild.members._add(Object.assign(data.member, { user: this.author }));
    }
    if ('flags' in data) {
      this.flags = new MessageFlags(data.flags).freeze();
    } else {
      this.flags = new MessageFlags(this.flags).freeze();
    }
    if ('message_reference' in data) {
      this.reference = {
        channelId: data.message_reference.channel_id,
        guildId: data.message_reference.guild_id,
        messageId: data.message_reference.message_id,
        type: MessageReferenceTypes[data.message_reference.type ?? 0],
      };
    } else {
      this.reference ??= null;
    }
    if (data.referenced_message) {
      this.channel?.messages._add({ guild_id: data.message_reference?.guild_id, ...data.referenced_message });
    }
    if (data.interaction) {
      this.interaction = {
        id: data.interaction.id,
        type: InteractionTypes[data.interaction.type],
        commandName: data.interaction.name,
        user: this.client.users._add(data.interaction.user),
      };
    } else {
      this.interaction ??= null;
    }
    if (data.message_snapshots) {
      this.messageSnapshots = data.message_snapshots.reduce((coll, snapshot) => {
        const channel = this.client.channels.cache.get(this.reference.channelId);
        const snapshotData = {
          ...snapshot.message,
          id: this.reference.messageId,
          channel_id: this.reference.channelId,
          guild_id: this.reference.guildId,
        };
        return coll.set(
          this.reference.messageId,
          channel ? channel.messages._add(snapshotData) : new this.constructor(this.client, snapshotData),
        );
      }, new Collection());
    } else {
      this.messageSnapshots ??= new Collection();
    }
    if (data.call) {
      this.call = {
        endedTimestamp: data.call.ended_timestamp ? Date.parse(data.call.ended_timestamp) : null,
        participants: data.call.participants,
        get endedAt() {
          return this.endedTimestamp && new Date(this.endedTimestamp);
        },
      };
    } else {
      this.call ??= null;
    }
  }
  get deleted() {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Message#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedMessages.has(this);
  }
  set deleted(value) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Message#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedMessages.add(this);
    else deletedMessages.delete(this);
  }
  get channel() {
    return this.client.channels.cache.get(this.channelId) ?? null;
  }
  get partial() {
    return typeof this.content !== 'string' || !this.author;
  }
  get member() {
    return this.guild?.members.resolve(this.author) ?? null;
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  get editedAt() {
    return this.editedTimestamp ? new Date(this.editedTimestamp) : null;
  }
  get guild() {
    return this.client.guilds.cache.get(this.guildId) ?? this.channel?.guild ?? null;
  }
  get hasThread() {
    return this.flags.has(MessageFlags.FLAGS.HAS_THREAD);
  }
  get thread() {
    return this.channel?.threads?.cache.get(this.id) ?? null;
  }
  get url() {
    return `https://discord.com/channels/${this.guildId ?? '@me'}/${this.channelId}/${this.id}`;
  }
  get cleanContent() {
    return this.content != null && this.channel ? Util.cleanContent(this.content, this.channel) : null;
  }
  createReactionCollector(options = {}) {
    return new ReactionCollector(this, options);
  }
  awaitReactions(options = {}) {
    return new Promise((resolve, reject) => {
      const collector = this.createReactionCollector(options);
      collector.once('end', (reactions, reason) => {
        if (options.errors?.includes(reason)) reject(reactions);
        else resolve(reactions);
      });
    });
  }
  get editable() {
    const precheck = Boolean(
      this.author.id === this.client.user.id &&
        !deletedMessages.has(this) &&
        (!this.guild || this.channel?.viewable) &&
        this.reference?.type !== 'FORWARD',
    );
    if (this.channel?.isThread()) {
      if (this.channel.archived) return false;
      if (this.channel.locked) {
        const permissions = this.channel.permissionsFor(this.client.user);
        if (!permissions?.has(Permissions.FLAGS.MANAGE_THREADS, true)) return false;
      }
    }
    return precheck;
  }
  get deletable() {
    if (deletedMessages.has(this)) {
      return false;
    }
    if (!this.guild) {
      return this.author.id === this.client.user.id;
    }
    if (!this.channel?.viewable) {
      return false;
    }
    const permissions = this.channel?.permissionsFor(this.client.user);
    if (!permissions) return false;
    if (permissions.has(Permissions.FLAGS.ADMINISTRATOR, false)) return true;
    return Boolean(
      this.author.id === this.client.user.id ||
        (permissions.has(Permissions.FLAGS.MANAGE_MESSAGES, false) &&
          this.guild.members.me.communicationDisabledUntilTimestamp < Date.now()),
    );
  }
  get bulkDeletable() {
    return false;
  }
  get pinnable() {
    const { channel } = this;
    return Boolean(
      !this.system &&
        !deletedMessages.has(this) &&
        (!this.guild ||
          (channel?.viewable &&
            channel?.permissionsFor(this.client.user)?.has(Permissions.FLAGS.MANAGE_MESSAGES, false))),
    );
  }
  async fetchReference() {
    if (!this.reference) throw new Error('MESSAGE_REFERENCE_MISSING');
    const { channelId, messageId } = this.reference;
    if (!messageId) throw new Error('MESSAGE_REFERENCE_MISSING');
    const channel = this.client.channels.resolve(channelId);
    if (!channel) throw new Error('GUILD_CHANNEL_RESOLVE');
    const message = await channel.messages.fetch(messageId);
    return message;
  }
  get crosspostable() {
    const bitfield =
      Permissions.FLAGS.SEND_MESSAGES |
      (this.author.id === this.client.user.id ? Permissions.defaultBit : Permissions.FLAGS.MANAGE_MESSAGES);
    const { channel } = this;
    return Boolean(
      channel?.type === 'GUILD_NEWS' &&
        !this.flags.has(MessageFlags.FLAGS.CROSSPOSTED) &&
        this.type === 'DEFAULT' &&
        !this.poll &&
        channel.viewable &&
        channel.permissionsFor(this.client.user)?.has(bitfield, false) &&
        !deletedMessages.has(this),
    );
  }
  async edit(options) {
    if (!this.channel) throw new Error('CHANNEL_NOT_CACHED');
    return this.channel.messages.edit(this, options);
  }
  async crosspost() {
    if (!this.channel) throw new Error('CHANNEL_NOT_CACHED');
    return this.channel.messages.crosspost(this.id);
  }
  async pin(reason) {
    if (!this.channel) throw new Error('CHANNEL_NOT_CACHED');
    await this.channel.messages.pin(this.id, reason);
    return this;
  }
  async unpin(reason) {
    if (!this.channel) throw new Error('CHANNEL_NOT_CACHED');
    await this.channel.messages.unpin(this.id, reason);
    return this;
  }
  async react(emoji, burst = false) {
    if (!this.channel) throw new Error('CHANNEL_NOT_CACHED');
    await this.channel.messages.react(this.id, emoji, burst);
    return this.client.actions.MessageReactionAdd.handle(
      {
        [this.client.actions.injectedUser]: this.client.user,
        [this.client.actions.injectedChannel]: this.channel,
        [this.client.actions.injectedMessage]: this,
        emoji: Util.resolvePartialEmoji(emoji),
        me_burst: burst,
      },
      true,
    ).reaction;
  }
  async delete() {
    if (!this.channel) throw new Error('CHANNEL_NOT_CACHED');
    await this.channel.messages.delete(this.id);
    return this;
  }
  async reply(options) {
    if (!this.channel) throw new Error('CHANNEL_NOT_CACHED');
    let data;
    if (options instanceof MessagePayload) {
      data = options;
    } else {
      data = MessagePayload.create(this, options, {
        reply: {
          messageReference: this,
          failIfNotExists: options?.failIfNotExists ?? this.client.options.failIfNotExists,
        },
      });
    }
    return this.channel.send(data);
  }
  forward(channel) {
    const resolvedChannel = this.client.channels.resolve(channel);
    if (!resolvedChannel) throw new Error('INVALID_TYPE', 'channel', 'TextBasedChannelResolvable');
    return resolvedChannel.send({
      forward: {
        message: this.id,
        channel: this.channelId,
        guild: this.guildId,
      },
    });
  }
  async startThread(options = {}) {
    if (!this.channel) throw new Error('CHANNEL_NOT_CACHED');
    if (!['GUILD_TEXT', 'GUILD_NEWS'].includes(this.channel.type)) {
      throw new Error('MESSAGE_THREAD_PARENT');
    }
    if (this.hasThread) throw new Error('MESSAGE_EXISTING_THREAD');
    return this.channel.threads.create({ ...options, startMessage: this });
  }
  vote(...ids) {
    return this.client.api
      .channels(this.channel.id)
      .polls(this.id)
      .answers['@me'].put({
        data: {
          answer_ids: ids.flat(1).map(value => value.toString()),
        },
      });
  }
  async fetch(force = true) {
    if (!this.channel) throw new Error('CHANNEL_NOT_CACHED');
    return this.channel.messages.fetch(this.id, { force });
  }
  async fetchWebhook() {
    if (!this.webhookId) throw new Error('WEBHOOK_MESSAGE');
    if (this.webhookId === this.applicationId) throw new Error('WEBHOOK_APPLICATION');
    return this.client.fetchWebhook(this.webhookId);
  }
  suppressEmbeds(suppress = true) {
    const flags = new MessageFlags(this.flags.bitfield);
    if (suppress) {
      flags.add(MessageFlags.FLAGS.SUPPRESS_EMBEDS);
    } else {
      flags.remove(MessageFlags.FLAGS.SUPPRESS_EMBEDS);
    }
    return this.edit({ flags });
  }
  removeAttachments() {
    return this.edit({ attachments: [] });
  }
  resolveComponent(customId) {
    return this.components.flatMap(row => row.components).find(component => component.customId === customId) ?? null;
  }
  equals(message, rawData) {
    if (!message) return false;
    const embedUpdate = !message.author && !message.attachments;
    if (embedUpdate) return this.id === message.id && this.embeds.length === message.embeds.length;
    let equal =
      this.id === message.id &&
      this.author.id === message.author.id &&
      this.content === message.content &&
      this.tts === message.tts &&
      this.nonce === message.nonce &&
      this.embeds.length === message.embeds.length &&
      this.attachments.size === message.attachments.size &&
      this.attachments.every(attachment => message.attachments.has(attachment.id)) &&
      this.embeds.every((embed, index) => embed.equals(message.embeds[index]));
    if (equal && rawData) {
      equal =
        this.mentions.everyone === message.mentions.everyone &&
        this.createdTimestamp === new Date(rawData.timestamp).getTime() &&
        this.editedTimestamp === new Date(rawData.edited_timestamp).getTime();
    }
    return equal;
  }
  inGuild() {
    return Boolean(this.guildId);
  }
  toString() {
    return this.content;
  }
  toJSON() {
    return super.toJSON({
      channel: 'channelId',
      author: 'authorId',
      groupActivityApplication: 'groupActivityApplicationId',
      guild: 'guildId',
      cleanContent: true,
      member: false,
      reactions: false,
    });
  }
  get isMessage() {
    return true;
  }
  clickButton(button) {
    if (typeof button == 'undefined') {
      button = this.components
        .flatMap(row => row.components)
        .find(b => b.type === 'BUTTON' && b.customId && !b.disabled);
    } else if (typeof button == 'string') {
      button = this.components.flatMap(row => row.components).find(b => b.type === 'BUTTON' && b.customId == button);
    } else {
      button = this.components[button.Y]?.components[button.X];
    }
    if (!button) throw new TypeError('BUTTON_NOT_FOUND');
    button = button.toJSON();
    if (!button.custom_id || button.disabled) throw new TypeError('BUTTON_CANNOT_CLICK');
    const nonce = SnowflakeUtil.generate();
    const data = {
      type: InteractionTypes.MESSAGE_COMPONENT,
      nonce,
      guild_id: this.guildId,
      channel_id: this.channelId,
      message_id: this.id,
      application_id: this.applicationId ?? this.author.id,
      session_id: this.client.sessionId,
      message_flags: this.flags.bitfield,
      data: {
        component_type: MessageComponentTypes.BUTTON,
        custom_id: button.custom_id,
      },
    };
    this.client.api.interactions.post({
      data,
    });
    return Util.createPromiseInteraction(this.client, nonce, 5_000, true, this);
  }
  selectMenu(menu, values = []) {
    let selectMenu = menu;
    if (/[0-4]/.test(menu)) {
      selectMenu = this.components[menu]?.components[0];
    } else if (typeof menu == 'string') {
      selectMenu = this.components
        .flatMap(row => row.components)
        .find(
          b =>
            ['STRING_SELECT', 'USER_SELECT', 'ROLE_SELECT', 'MENTIONABLE_SELECT', 'CHANNEL_SELECT'].includes(b.type) &&
            b.customId == menu &&
            !b.disabled,
        );
    }
    if (values.length < selectMenu.minValues) {
      throw new RangeError(`[SELECT_MENU_MIN_VALUES] The minimum number of values is ${selectMenu.minValues}`);
    }
    if (values.length > selectMenu?.maxValues) {
      throw new RangeError(`[SELECT_MENU_MAX_VALUES] The maximum number of values is ${selectMenu.maxValues}`);
    }
    values = values.map(value => {
      switch (selectMenu.type) {
        case 'STRING_SELECT': {
          return selectMenu.options.find(obj => obj.value === value || obj.label === value).value;
        }
        case 'USER_SELECT': {
          return this.client.users.resolveId(value);
        }
        case 'ROLE_SELECT': {
          return this.guild.roles.resolveId(value);
        }
        case 'MENTIONABLE_SELECT': {
          return this.client.users.resolveId(value) || this.guild.roles.resolveId(value);
        }
        case 'CHANNEL_SELECT': {
          return this.client.channels.resolveId(value);
        }
        default: {
          return value;
        }
      }
    });
    const nonce = SnowflakeUtil.generate();
    const data = {
      type: InteractionTypes.MESSAGE_COMPONENT,
      guild_id: this.guildId,
      channel_id: this.channelId,
      message_id: this.id,
      application_id: this.applicationId ?? this.author.id,
      session_id: this.client.sessionId,
      message_flags: this.flags.bitfield,
      data: {
        component_type: MessageComponentTypes[selectMenu.type],
        custom_id: selectMenu.customId,
        type: MessageComponentTypes[selectMenu.type],
        values,
      },
      nonce,
    };
    this.client.api.interactions.post({
      data,
    });
    return Util.createPromiseInteraction(this.client, nonce, 5_000, true, this);
  }
  markUnread() {
    return this.client.api.channels[this.channelId].messages[this.id].ack.post({
      data: {
        manual: true,
        mention_count: 1,
      },
    });
  }
  markRead() {
    return this.client.api.channels[this.channelId].messages[this.id].ack.post({
      data: {
        token: null,
      },
    });
  }
  report(breadcrumbs, elements = {}) {
    return this.client.api.reporting.message.post({
      data: {
        version: '1.0',
        variant: '4',
        language: 'en',
        breadcrumbs,
        elements,
        channel_id: this.channelId,
        message_id: this.id,
        name: 'message',
      },
    });
  }
}
exports.Message = Message;
exports.deletedMessages = deletedMessages;
