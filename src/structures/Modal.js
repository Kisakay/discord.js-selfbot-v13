'use strict';
const BaseMessageComponent = require('./BaseMessageComponent');
const { InteractionTypes } = require('../util/Constants');
const SnowflakeUtil = require('../util/SnowflakeUtil');
const Util = require('../util/Util');
class Modal {
  constructor(data = {}, client = null) {
    this.components = data.components?.map(c => BaseMessageComponent.create(c, client)) ?? [];
    this.customId = data.custom_id;
    this.title = data.title;
    this.nonce = data.nonce;
    this.id = data.id;
    this.applicationId = data.application.id;
    this.channelId = data.channel_id;
    this.replied = false;
    Object.defineProperty(this, 'client', {
      value: client,
      writable: false,
    });
  }
  get guildId() {
    return this.client.channels.cache.get(this.channelId)?.guildId || null;
  }
  get channel() {
    return this.client.channels.resolve(this.channelId);
  }
  get guild() {
    return this.client.guilds.resolve(this.guildId) ?? this.channel?.guild ?? null;
  }
  toJSON() {
    return {
      components: this.components.map(c => c.toJSON()),
      custom_id: this.customId,
      title: this.title,
      id: this.id,
    };
  }
  reply() {
    if (!this.applicationId || !this.client || !this.channelId || this.replied) throw new Error('Modal cannot reply');
    const dataFinal = this.toJSON();
    dataFinal.components = dataFinal.components
      .map(c => {
        c.components[0] = {
          type: c.components[0].type,
          value: c.components[0].value,
          custom_id: c.components[0].custom_id,
        };
        return c;
      })
      .filter(c => typeof c.components[0].value == 'string');
    delete dataFinal.title;
    const nonce = SnowflakeUtil.generate();
    const postData = {
      type: InteractionTypes.MODAL_SUBMIT, 
      application_id: this.applicationId,
      guild_id: this.guildId,
      channel_id: this.channelId,
      data: dataFinal,
      nonce,
      session_id: this.client.sessionId,
    };
    this.client.api.interactions.post({
      data: postData,
    });
    this.replied = true;
    return Util.createPromiseInteraction(this.client, nonce, 5_000, true, this);
  }
  get isMessage() {
    return false;
  }
}
module.exports = Modal;
