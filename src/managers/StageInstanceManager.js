'use strict';
const CachedManager = require('./CachedManager');
const { TypeError, Error } = require('../errors');
const { StageInstance } = require('../structures/StageInstance');
const { PrivacyLevels } = require('../util/Constants');
class StageInstanceManager extends CachedManager {
  constructor(guild, iterable) {
    super(guild.client, StageInstance, iterable);
    this.guild = guild;
  }
  async create(channel, options) {
    const channelId = this.guild.channels.resolveId(channel);
    if (!channelId) throw new Error('STAGE_CHANNEL_RESOLVE');
    if (typeof options !== 'object') throw new TypeError('INVALID_TYPE', 'options', 'object', true);
    let { guildScheduledEvent, topic, privacyLevel, sendStartNotification } = options;
    privacyLevel &&= typeof privacyLevel === 'number' ? privacyLevel : PrivacyLevels[privacyLevel];
    const guildScheduledEventId = guildScheduledEvent && this.resolveId(guildScheduledEvent);
    const data = await this.client.api['stage-instances'].post({
      data: {
        channel_id: channelId,
        topic,
        privacy_level: privacyLevel,
        send_start_notification: sendStartNotification,
        guild_scheduled_event_id: guildScheduledEventId,
      },
    });
    return this._add(data);
  }
  async fetch(channel, { cache = true, force = false } = {}) {
    const channelId = this.guild.channels.resolveId(channel);
    if (!channelId) throw new Error('STAGE_CHANNEL_RESOLVE');
    if (!force) {
      const existing = this.cache.find(stageInstance => stageInstance.channelId === channelId);
      if (existing) return existing;
    }
    const data = await this.client.api('stage-instances', channelId).get();
    return this._add(data, cache);
  }
  async edit(channel, options) {
    if (typeof options !== 'object') throw new TypeError('INVALID_TYPE', 'options', 'object', true);
    const channelId = this.guild.channels.resolveId(channel);
    if (!channelId) throw new Error('STAGE_CHANNEL_RESOLVE');
    let { topic, privacyLevel } = options;
    privacyLevel &&= typeof privacyLevel === 'number' ? privacyLevel : PrivacyLevels[privacyLevel];
    const data = await this.client.api('stage-instances', channelId).patch({
      data: {
        topic,
        privacy_level: privacyLevel,
      },
    });
    if (this.cache.has(data.id)) {
      const clone = this.cache.get(data.id)._clone();
      clone._patch(data);
      return clone;
    }
    return this._add(data);
  }
  async delete(channel) {
    const channelId = this.guild.channels.resolveId(channel);
    if (!channelId) throw new Error('STAGE_CHANNEL_RESOLVE');
    await this.client.api('stage-instances', channelId).delete();
  }
}
module.exports = StageInstanceManager;
