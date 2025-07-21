'use strict';
const process = require('node:process');
const Base = require('./Base');
const { PrivacyLevels } = require('../util/Constants');
const SnowflakeUtil = require('../util/SnowflakeUtil');
const deletedStageInstances = new WeakSet();
let deprecationEmittedForDeleted = false;
class StageInstance extends Base {
  constructor(client, data) {
    super(client);
    this.id = data.id;
    this._patch(data);
  }
  _patch(data) {
    if ('guild_id' in data) {
      this.guildId = data.guild_id;
    }
    if ('channel_id' in data) {
      this.channelId = data.channel_id;
    }
    if ('topic' in data) {
      this.topic = data.topic;
    }
    if ('privacy_level' in data) {
      this.privacyLevel = PrivacyLevels[data.privacy_level];
    }
    if ('discoverable_disabled' in data) {
      this.discoverableDisabled = data.discoverable_disabled;
    } else {
      this.discoverableDisabled ??= null;
    }
    if ('guild_scheduled_event_id' in data) {
      this.guildScheduledEventId = data.guild_scheduled_event_id;
    } else {
      this.guildScheduledEventId ??= null;
    }
  }
  get channel() {
    return this.client.channels.resolve(this.channelId);
  }
  get guildScheduledEvent() {
    return this.guild?.scheduledEvents.resolve(this.guildScheduledEventId) ?? null;
  }
  get deleted() {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'StageInstance#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedStageInstances.has(this);
  }
  set deleted(value) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'StageInstance#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedStageInstances.add(this);
    else deletedStageInstances.delete(this);
  }
  get guild() {
    return this.client.guilds.resolve(this.guildId);
  }
  edit(options) {
    return this.guild.stageInstances.edit(this.channelId, options);
  }
  async delete() {
    await this.guild.stageInstances.delete(this.channelId);
    const clone = this._clone();
    deletedStageInstances.add(clone);
    return clone;
  }
  setTopic(topic) {
    return this.guild.stageInstances.edit(this.channelId, { topic });
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
}
exports.StageInstance = StageInstance;
exports.deletedStageInstances = deletedStageInstances;
