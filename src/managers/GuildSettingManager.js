'use strict';
const BaseManager = require('./BaseManager');
class GuildSettingManager extends BaseManager {
  #rawSetting = {};
  constructor(guild) {
    super(guild.client);
    this.guildId = guild.id;
  }
  get raw() {
    return this.#rawSetting;
  }
  get guild() {
    return this.client.guilds.cache.get(this.guildId);
  }
  _patch(data = {}) {
    this.#rawSetting = Object.assign(this.#rawSetting, data);
    this.client.emit('debug', `[SETTING > Guild ${this.guildId}] Sync setting`);
    if ('suppress_everyone' in data) {
      this.suppressEveryone = data.suppress_everyone;
    }
    if ('suppress_roles' in data) {
      this.suppressRoles = data.suppress_roles;
    }
    if ('mute_scheduled_events' in data) {
      this.muteScheduledEvents = data.mute_scheduled_events;
    }
    if ('message_notifications' in data) {
      this.messageNotifications = data.message_notifications;
    }
    if ('flags' in data) {
      this.flags = data.flags;
    }
    if ('mobile_push' in data) {
      this.mobilePush = data.mobile_push;
    }
    if ('muted' in data) {
      this.muted = data.muted;
    }
    if ('mute_config' in data && data.mute_config !== null) {
      this.muteConfig = {
        endTime: new Date(data.mute_config.end_time),
        selectedTimeWindow: data.mute_config.selected_time_window,
      };
    } else {
      this.muteConfig = null;
    }
    if ('hide_muted_channels' in data) {
      this.hideMutedChannels = data.hide_muted_channels;
    }
    if ('channel_overrides' in data) {
      this.channelOverrides = data.channel_overrides;
    }
    if ('notify_highlights' in data) {
      this.notifyHighlights = data.notify_highlights;
    }
    if ('version' in data) {
      this.version = data.version;
    }
  }
  async edit(data) {
    const data_ = await this.client.api.users('@me').settings.patch(data);
    this._patch(data_);
    return this;
  }
}
module.exports = GuildSettingManager;
