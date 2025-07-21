'use strict';
const { Collection } = require('@discordjs/collection');
const { Channel } = require('./Channel');
const Invite = require('./Invite');
const TextBasedChannel = require('./interfaces/TextBasedChannel');
const MessageManager = require('../managers/MessageManager');
const { Status, Opcodes } = require('../util/Constants');
const DataResolver = require('../util/DataResolver');
class GroupDMChannel extends Channel {
  constructor(client, data) {
    super(client, data);
    this.type = 'GROUP_DM';
    this.messages = new MessageManager(this);
  }
  _patch(data) {
    super._patch(data);
    if ('recipients' in data && Array.isArray(data.recipients)) {
      this._recipients = data.recipients;
      data.recipients.forEach(u => this.client.users._add(u));
    } else {
      this._recipients = [];
    }
    if ('owner_id' in data) {
      this.ownerId = data.owner_id;
    } else {
      this.ownerId ??= null;
    }
    if ('last_message_id' in data) {
      this.lastMessageId = data.last_message_id;
    } else {
      this.lastMessageId ??= null;
    }
    if ('last_pin_timestamp' in data) {
      this.lastPinTimestamp = data.last_pin_timestamp ? Date.parse(data.last_pin_timestamp) : null;
    } else {
      this.lastPinTimestamp ??= null;
    }
    if ('name' in data) {
      this.name = data.name;
    }
    if ('icon' in data) {
      this.icon = data.icon;
    }
  }
  iconURL({ format, size } = {}) {
    return this.icon && this.client.rest.cdn.GDMIcon(this.id, this.icon, format, size);
  }
  get recipients() {
    const collect = new Collection();
    this._recipients.map(recipient => collect.set(recipient.id, this.client.users.cache.get(recipient.id)));
    collect.set(this.client.user.id, this.client.user);
    return collect;
  }
  get owner() {
    return this.client.users.cache.get(this.ownerId);
  }
  get partial() {
    return typeof this.lastMessageId === 'undefined';
  }
  async delete(slient = false) {
    if (typeof slient === 'boolean' && slient) {
      await this.client.api.channels[this.id].delete({
        query: {
          silent: true,
        },
      });
    } else {
      await this.client.api.channels[this.id].delete();
    }
    return this;
  }
  toString() {
    return (
      this.name ??
      this._recipients
        .filter(user => user.id !== this.client.user.id)
        .map(user => user.username)
        .join(', ')
    );
  }
  toJSON() {
    const json = super.toJSON({
      createdTimestamp: true,
    });
    json.iconURL = this.iconURL();
    return json;
  }
  async edit(data) {
    const _data = {};
    if ('name' in data) _data.name = data.name?.trim() ?? null;
    if (typeof data.icon !== 'undefined') {
      _data.icon = await DataResolver.resolveImage(data.icon);
    }
    if ('owner' in data) {
      _data.owner = data.owner;
    }
    const newData = await this.client.api.channels[this.id].patch({
      data: _data,
    });
    return this.client.actions.ChannelUpdate.handle(newData).updated;
  }
  setName(name) {
    return this.edit({ name });
  }
  setIcon(icon) {
    return this.edit({ icon });
  }
  setOwner(user) {
    const id = this.client.users.resolveId(user);
    if (this.ownerId === id) {
      return Promise.resolve(this);
    }
    return this.edit({ owner: id });
  }
  async addUser(user) {
    user = this.client.users.resolveId(user);
    await this.client.api.channels[this.id].recipients[user].put();
    return this;
  }
  async removeUser(user) {
    user = this.client.users.resolveId(user);
    await this.client.api.channels[this.id].recipients[user].delete();
    return this;
  }
  async getInvite() {
    const inviteCode = await this.client.api.channels(this.id).invites.post({
      data: {
        max_age: 86400,
      },
    });
    return new Invite(this.client, inviteCode);
  }
  async fetchAllInvite() {
    const invites = await this.client.api.channels(this.id).invites.get();
    return new Collection(invites.map(invite => [invite.code, new Invite(this.client, invite)]));
  }
  async removeInvite(invite) {
    let code = invite?.code;
    if (!code && URL.canParse(invite)) code = new URL(invite).pathname.slice(1);
    else code = invite;
    await this.client.api.channels(this.id).invites[invite].delete();
    return this;
  }
  ring(recipients) {
    if (!recipients || !Array.isArray(recipients) || recipients.length == 0) {
      recipients = null;
    } else {
      recipients = recipients.map(r => this.client.users.resolveId(r)).filter(r => r && this.recipients.get(r));
    }
    return this.client.api.channels(this.id).call.ring.post({
      data: {
        recipients,
      },
    });
  }
  sync() {
    this.client.ws.broadcast({
      op: Opcodes.DM_UPDATE,
      d: {
        channel_id: this.id,
      },
    });
  }
  get shard() {
    return this.client.ws.shards.first();
  }
  get lastMessage() {}
  get lastPinAt() {}
  send() {}
  sendTyping() {}
  createMessageCollector() {}
  awaitMessages() {}
}
TextBasedChannel.applyToClass(GroupDMChannel, true, [
  'fetchWebhooks',
  'createWebhook',
  'setRateLimitPerUser',
  'setNSFW',
]);
module.exports = GroupDMChannel;
