'use strict';
const { Collection } = require('@discordjs/collection');
const BaseManager = require('./BaseManager');
const { TypeError } = require('../errors/DJSError');
const { CustomStatus } = require('../structures/Presence');
const { ActivityTypes } = require('../util/Constants');
class ClientUserSettingManager extends BaseManager {
  #rawSetting = {};
  constructor(client) {
    super(client);
    this.addFriendFrom = {
      all: null,
      mutual_friends: null,
      mutual_guilds: null,
    };
  }
  _patch(data = {}) {
    this.#rawSetting = Object.assign(this.#rawSetting, data);
    this.client.emit('debug', `[SETTING > ClientUser] Sync setting`);
    if ('locale' in data) {
      this.locale = data.locale;
    }
    if ('show_current_game' in data) {
      this.activityDisplay = data.show_current_game;
    }
    if ('default_guilds_restricted' in data) {
      this.allowDMsFromGuild = data.default_guilds_restricted;
    }
    if ('inline_attachment_media' in data) {
      this.displayImage = data.inline_attachment_media;
    }
    if ('inline_embed_media' in data) {
      this.linkedImageDisplay = data.inline_embed_media;
    }
    if ('gif_auto_play' in data) {
      this.autoplayGIF = data.gif_auto_play;
    }
    if ('render_embeds' in data) {
      this.previewLink = data.render_embeds;
    }
    if ('animate_emoji' in data) {
      this.animatedEmoji = data.animate_emoji;
    }
    if ('enable_tts_command' in data) {
      this.allowTTS = data.enable_tts_command;
    }
    if ('message_display_compact' in data) {
      this.compactMode = data.message_display_compact;
    }
    if ('convert_emoticons' in data) {
      this.convertEmoticons = data.convert_emoticons;
    }
    if ('explicit_content_filter' in data) {
      this.DMScanLevel = data.explicit_content_filter;
    }
    if ('theme' in data) {
      this.theme = data.theme;
    }
    if ('developer_mode' in data) {
      this.developerMode = data.developer_mode;
    }
    if ('afk_timeout' in data) {
      this.afkTimeout = data.afk_timeout;
    }
    if ('animate_stickers' in data) {
      this.stickerAnimationMode = data.animate_stickers;
    }
    if ('render_reactions' in data) {
      this.showEmojiReactions = data.render_reactions;
    }
    if ('status' in data) {
      this.client.presence.status = data.status;
      if (!('custom_status' in data)) {
        this.client.emit('debug', '[SETTING > ClientUser] Sync status');
        this.client.user.setStatus(data.status);
      }
    }
    if ('custom_status' in data) {
      this.customStatus = data.custom_status;
      const activities = this.client.presence.activities.filter(
        a => ![ActivityTypes.CUSTOM, 'CUSTOM'].includes(a.type),
      );
      if (data.custom_status) {
        const custom = new CustomStatus(this.client);
        custom.setState(data.custom_status.text);
        let emoji;
        if (data.custom_status.emoji_id) {
          emoji = this.client.emojis.cache.get(data.custom_status.emoji_id);
        } else if (data.custom_status.emoji_name) {
          emoji = `:${data.custom_status.emoji_name}:`;
        }
        if (emoji) custom.setEmoji(emoji);
        activities.push(custom);
      }
      this.client.emit('debug', '[SETTING > ClientUser] Sync activities & status');
      this.client.user.setPresence({ activities });
    }
    if ('friend_source_flags' in data) {
    }
    if ('restricted_guilds' in data) {
      this.disableDMfromGuilds = new Collection(
        data.restricted_guilds.map(guildId => [guildId, this.client.guilds.cache.get(guildId)]),
      );
    }
  }
  get raw() {
    return this.#rawSetting;
  }
  async fetch() {
    const data = await this.client.api.users('@me').settings.get();
    this._patch(data);
    return this;
  }
  async edit(data) {
    const res = await this.client.api.users('@me').settings.patch({ data });
    this._patch(res);
    return this;
  }
  toggleCompactMode() {
    return this.edit({ message_display_compact: !this.compactMode });
  }
  setTheme(value) {
    const validValues = ['dark', 'light'];
    if (!validValues.includes(value)) {
      throw new TypeError('INVALID_TYPE', 'value', 'dark | light', true);
    }
    return this.edit({ theme: value });
  }
  setCustomStatus(options) {
    if (typeof options !== 'object') {
      return this.edit({ custom_status: null });
    } else if (options instanceof CustomStatus) {
      options = options.toJSON();
      let data = {
        emoji_name: null,
        expires_at: null,
        text: null,
      };
      if (typeof options.state === 'string') {
        data.text = options.state;
      }
      if (options.emoji) {
        if (options.emoji?.id) {
          data.emoji_name = options.emoji?.name;
          data.emoji_id = options.emoji?.id;
        } else {
          data.emoji_name = typeof options.emoji?.name === 'string' ? options.emoji?.name : null;
        }
      }
      return this.edit({ custom_status: data });
    } else {
      let data = {
        emoji_name: null,
        expires_at: null,
        text: null,
      };
      if (typeof options.text === 'string') {
        if (options.text.length > 128) {
          throw new RangeError('[INVALID_VALUE] Custom status text must be less than 128 characters');
        }
        data.text = options.text;
      }
      if (options.emoji) {
        const emoji = this.client.emojis.resolve(options.emoji);
        if (emoji) {
          data.emoji_name = emoji.name;
          data.emoji_id = emoji.id;
        } else {
          data.emoji_name = typeof options.emoji === 'string' ? options.emoji : null;
        }
      }
      if (typeof options.expires === 'number') {
        if (options.expires < Date.now()) {
          throw new RangeError(`[INVALID_VALUE] Custom status expiration must be greater than ${Date.now()}`);
        }
        data.expires_at = new Date(options.expires).toISOString();
      }
      if (['online', 'idle', 'dnd', 'invisible'].includes(options.status)) this.edit({ status: options.status });
      return this.edit({ custom_status: data });
    }
  }
  restrictedGuilds(status) {
    if (typeof status !== 'boolean') {
      throw new TypeError('INVALID_TYPE', 'status', 'boolean', true);
    }
    return this.edit({
      default_guilds_restricted: status,
      restricted_guilds: status ? this.client.guilds.cache.map(v => v.id) : [],
    });
  }
  addRestrictedGuild(guildId) {
    const temp = Object.assign(
      [],
      this.disableDMfromServer.map((v, k) => k),
    );
    if (temp.includes(guildId)) throw new Error('Guild is already restricted');
    temp.push(guildId);
    return this.edit({ restricted_guilds: temp });
  }
  removeRestrictedGuild(guildId) {
    if (!this.disableDMfromServer.delete(guildId)) throw new Error('Guild is already restricted');
    return this.edit({ restricted_guilds: this.disableDMfromServer.map((v, k) => k) });
  }
}
module.exports = ClientUserSettingManager;
