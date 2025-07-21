'use strict';
const { randomUUID } = require('node:crypto');
const Base = require('./Base');
const ActivityFlags = require('../util/ActivityFlags');
const { ActivityTypes } = require('../util/Constants');
const Util = require('../util/Util');
class Presence extends Base {
  constructor(client, data = {}) {
    super(client);
    this.userId = data.user.id;
    this.guild = data.guild ?? null;
    this._patch(data);
  }
  get user() {
    return this.client.users.resolve(this.userId);
  }
  get member() {
    return this.guild.members.resolve(this.userId);
  }
  _patch(data) {
    if ('status' in data) {
      this.status = data.status;
    } else {
      this.status ??= 'offline';
    }
    if ('activities' in data) {
      this.activities = data.activities.map(activity => {
        if (this.userId == this.client.user.id) {
          if ([ActivityTypes.CUSTOM, 'CUSTOM'].includes(activity.type)) {
            return new CustomStatus(this.client, activity);
          } else if (activity.id == 'spotify:1') {
            return new SpotifyRPC(this.client, activity);
          } else {
            return new RichPresence(this.client, activity);
          }
        } else {
          return new Activity(this, activity);
        }
      });
    } else {
      this.activities ??= [];
    }
    if ('client_status' in data) {
      this.clientStatus = data.client_status;
    } else {
      this.clientStatus ??= null;
    }
    if ('last_modified' in data) {
      this.lastModified = data.last_modified;
    }
    if ('afk' in data) {
      this.afk = data.afk;
    } else {
      this.afk ??= false;
    }
    if ('since' in data) {
      this.since = data.since;
    } else {
      this.since ??= 0;
    }
    return this;
  }
  _clone() {
    const clone = Object.assign(Object.create(this), this);
    clone.activities = this.activities.map(activity => activity._clone());
    return clone;
  }
  equals(presence) {
    return (
      this === presence ||
      (presence &&
        this.status === presence.status &&
        this.clientStatus?.web === presence.clientStatus?.web &&
        this.clientStatus?.mobile === presence.clientStatus?.mobile &&
        this.clientStatus?.desktop === presence.clientStatus?.desktop &&
        this.activities.length === presence.activities.length &&
        this.activities.every((activity, index) => activity.equals(presence.activities[index])))
    );
  }
  toJSON() {
    return Util.flatten(this);
  }
}
class Activity {
  constructor(presence, data) {
    if (!(presence instanceof Presence)) {
      throw new Error("Class constructor Activity cannot be invoked without 'presence'");
    }
    Object.defineProperty(this, 'presence', { value: presence });
    this._patch(data);
  }
  _patch(data = {}) {
    if ('id' in data) {
      this.id = data.id;
    }
    if ('name' in data) {
      this.name = data.name;
    }
    if ('type' in data) {
      this.type = typeof data.type === 'number' ? ActivityTypes[data.type] : data.type;
    }
    if ('url' in data) {
      this.url = data.url;
    } else {
      this.url = null;
    }
    if ('created_at' in data || 'createdTimestamp' in data) {
      this.createdTimestamp = data.created_at || data.createdTimestamp;
    }
    if ('session_id' in data) {
      this.sessionId = data.session_id;
    } else {
      this.sessionId = this.presence.client?.sessionId;
    }
    if ('platform' in data) {
      this.platform = data.platform;
    } else {
      this.platform = null;
    }
    if ('timestamps' in data && data.timestamps) {
      this.timestamps = {
        start: data.timestamps.start ? new Date(data.timestamps.start).getTime() : null,
        end: data.timestamps.end ? new Date(data.timestamps.end).getTime() : null,
      };
    } else {
      this.timestamps = null;
    }
    if ('application_id' in data || 'applicationId' in data) {
      this.applicationId = data.application_id || data.applicationId;
    } else {
      this.applicationId = null;
    }
    if ('details' in data) {
      this.details = data.details;
    } else {
      this.details = null;
    }
    if ('state' in data) {
      this.state = data.state;
    } else {
      this.state = null;
    }
    if ('sync_id' in data || 'syncId' in data) {
      this.syncId = data.sync_id || data.syncId;
    } else {
      this.syncId = null;
    }
    if ('flags' in data) {
      this.flags = new ActivityFlags(data.flags).freeze();
    } else {
      this.flags = new ActivityFlags().freeze();
    }
    if ('buttons' in data) {
      this.buttons = data.buttons;
    } else {
      this.buttons = [];
    }
    if ('emoji' in data && data.emoji) {
      this.emoji = Util.resolvePartialEmoji(data.emoji);
    } else {
      this.emoji = null;
    }
    if ('party' in data) {
      this.party = data.party;
    } else {
      this.party = null;
    }
    this.assets = new RichPresenceAssets(this, data.assets);
  }
  equals(activity) {
    return (
      this === activity ||
      (activity &&
        this.name === activity.name &&
        this.type === activity.type &&
        this.url === activity.url &&
        this.state === activity.state &&
        this.details === activity.details &&
        this.emoji?.id === activity.emoji?.id &&
        this.emoji?.name === activity.emoji?.name)
    );
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  toString() {
    return this.name;
  }
  _clone() {
    return Object.assign(Object.create(this), this);
  }
  toJSON(...props) {
    return Util.clearNullOrUndefinedObject({
      ...Util.flatten(this, ...props),
      type: typeof this.type === 'number' ? this.type : ActivityTypes[this.type],
    });
  }
}
class RichPresenceAssets {
  constructor(activity, assets) {
    Object.defineProperty(this, 'activity', { value: activity });
    this._patch(assets);
  }
  _patch(assets = {}) {
    if ('large_text' in assets || 'largeText' in assets) {
      this.largeText = assets.large_text || assets.largeText;
    } else {
      this.largeText = null;
    }
    if ('small_text' in assets || 'smallText' in assets) {
      this.smallText = assets.small_text || assets.smallText;
    } else {
      this.smallText = null;
    }
    if ('large_image' in assets || 'largeImage' in assets) {
      this.largeImage = assets.large_image || assets.largeImage;
    } else {
      this.largeImage = null;
    }
    if ('small_image' in assets || 'smallImage' in assets) {
      this.smallImage = assets.small_image || assets.smallImage;
    } else {
      this.smallImage = null;
    }
  }
  smallImageURL({ format, size } = {}) {
    if (!this.smallImage) return null;
    if (this.smallImage.includes(':')) {
      const [platform, id] = this.smallImage.split(':');
      switch (platform) {
        case 'mp':
          return `https://media.discordapp.net/${id}`;
        case 'spotify':
          return `https://i.scdn.co/image/${id}`;
        case 'youtube':
          return `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg`;
        case 'twitch':
          return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${id}.png`;
        default:
          return null;
      }
    }
    return this.activity.presence.client.rest.cdn.AppAsset(this.activity.applicationId, this.smallImage, {
      format,
      size,
    });
  }
  largeImageURL({ format, size } = {}) {
    if (!this.largeImage) return null;
    if (this.largeImage.includes(':')) {
      const [platform, id] = this.largeImage.split(':');
      switch (platform) {
        case 'mp':
          return `https://media.discordapp.net/${id}`;
        case 'spotify':
          return `https://i.scdn.co/image/${id}`;
        case 'youtube':
          return `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg`;
        case 'twitch':
          return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${id}.png`;
        default:
          return null;
      }
    }
    return this.activity.presence.client.rest.cdn.AppAsset(this.activity.applicationId, this.largeImage, {
      format,
      size,
    });
  }
  static parseImage(image) {
    if (typeof image != 'string') {
      image = null;
    } else if (URL.canParse(image) && ['http:', 'https:'].includes(new URL(image).protocol)) {
      image = image
        .replace('https://cdn.discordapp.com/', 'mp:')
        .replace('http://cdn.discordapp.com/', 'mp:')
        .replace('https://media.discordapp.net/', 'mp:')
        .replace('http://media.discordapp.net/', 'mp:');
      if (!image.startsWith('mp:')) {
        throw new Error('INVALID_URL');
      }
    } else if (/^[0-9]{17,19}$/.test(image)) {
    } else if (['mp:', 'youtube:', 'spotify:', 'twitch:'].some(v => image.startsWith(v))) {
    } else if (image.startsWith('external/')) {
      image = `mp:${image}`;
    }
    return image;
  }
  toJSON() {
    if (!this.largeImage && !this.largeText && !this.smallImage && !this.smallText) return null;
    return {
      large_image: RichPresenceAssets.parseImage(this.largeImage),
      large_text: this.largeText,
      small_image: RichPresenceAssets.parseImage(this.smallImage),
      small_text: this.smallText,
    };
  }
  setLargeImage(image) {
    image = RichPresenceAssets.parseImage(image);
    this.largeImage = image;
    return this;
  }
  setSmallImage(image) {
    image = RichPresenceAssets.parseImage(image);
    this.smallImage = image;
    return this;
  }
  setLargeText(text) {
    this.largeText = text;
    return this;
  }
  setSmallText(text) {
    this.smallText = text;
    return this;
  }
}
class CustomStatus extends Activity {
  constructor(client, data = {}) {
    if (!client) throw new Error("Class constructor CustomStatus cannot be invoked without 'client'");
    super('presence' in client ? client.presence : client, {
      name: ' ',
      type: ActivityTypes.CUSTOM,
      ...data,
    });
  }
  setEmoji(emoji) {
    this.emoji = Util.resolvePartialEmoji(emoji);
    return this;
  }
  setState(state) {
    if (typeof state == 'string' && state.length > 128) throw new Error('State must be less than 128 characters');
    this.state = state;
    return this;
  }
  toJSON() {
    if (!this.emoji & !this.state) throw new Error('CustomStatus must have at least one of emoji or state');
    return {
      name: this.name,
      emoji: this.emoji,
      type: ActivityTypes.CUSTOM,
      state: this.state,
    };
  }
}
class RichPresence extends Activity {
  constructor(client, data = {}) {
    if (!client) throw new Error("Class constructor RichPresence cannot be invoked without 'client'");
    super('presence' in client ? client.presence : client, { type: 0, ...data });
    this.setup(data);
  }
  setup(data = {}) {
    this.secrets = 'secrets' in data ? data.secrets : {};
    this.metadata = 'metadata' in data ? data.metadata : {};
  }
  setAssetsLargeImage(image) {
    this.assets.setLargeImage(image);
    return this;
  }
  setAssetsSmallImage(image) {
    this.assets.setSmallImage(image);
    return this;
  }
  setAssetsLargeText(text) {
    this.assets.setLargeText(text);
    return this;
  }
  setAssetsSmallText(text) {
    this.assets.setSmallText(text);
    return this;
  }
  setName(name) {
    this.name = name;
    return this;
  }
  setURL(url) {
    if (typeof url == 'string' && !URL.canParse(url)) throw new Error('URL must be a valid URL');
    this.url = url;
    return this;
  }
  setType(type) {
    this.type = typeof type == 'number' ? type : ActivityTypes[type];
    return this;
  }
  setApplicationId(id) {
    this.applicationId = id;
    return this;
  }
  setState(state) {
    this.state = state;
    return this;
  }
  setDetails(details) {
    this.details = details;
    return this;
  }
  setParty(party) {
    if (typeof party == 'object') {
      if (!party.max || typeof party.max != 'number') throw new Error('Party must have max number');
      if (!party.current || typeof party.current != 'number') throw new Error('Party must have current');
      if (party.current > party.max) throw new Error('Party current must be less than max number');
      if (!party.id || typeof party.id != 'string') party.id = randomUUID();
      this.party = {
        size: [party.current, party.max],
        id: party.id,
      };
    } else {
      this.party = null;
    }
    return this;
  }
  setStartTimestamp(timestamp) {
    if (!this.timestamps) this.timestamps = {};
    if (timestamp instanceof Date) timestamp = timestamp.getTime();
    this.timestamps.start = timestamp;
    return this;
  }
  setEndTimestamp(timestamp) {
    if (!this.timestamps) this.timestamps = {};
    if (timestamp instanceof Date) timestamp = timestamp.getTime();
    this.timestamps.end = timestamp;
    return this;
  }
  setButtons(...button) {
    if (button.length == 0) {
      this.buttons = [];
      delete this.metadata.button_urls;
      return this;
    } else if (button.length > 2) {
      throw new Error('RichPresence can only have up to 2 buttons');
    }
    this.buttons = [];
    this.metadata.button_urls = [];
    button.flat(2).forEach(b => {
      if (b.name && b.url) {
        this.buttons.push(b.name);
        if (!URL.canParse(b.url)) throw new Error('Button url must be a valid url');
        this.metadata.button_urls.push(b.url);
      } else {
        throw new Error('Button must have name and url');
      }
    });
    return this;
  }
  setPlatform(platform) {
    this.platform = platform;
    return this;
  }
  setJoinSecret(join) {
    this.secrets.join = join;
    return this;
  }
  addButton(name, url) {
    if (!name || !url) {
      throw new Error('Button must have name and url');
    }
    if (typeof name !== 'string') throw new Error('Button name must be a string');
    if (!URL.canParse(url)) throw new Error('Button url must be a valid url');
    this.buttons.push(name);
    if (Array.isArray(this.metadata.button_urls)) this.metadata.button_urls.push(url);
    else this.metadata.button_urls = [url];
    return this;
  }
  toJSON(...props) {
    return super.toJSON(
      {
        applicationId: 'application_id',
        sessionId: 'session_id',
        syncId: 'sync_id',
        createdTimestamp: 'created_at',
      },
      ...props,
    );
  }
  static async getExternal(client, applicationId, ...images) {
    if (!client || !client.token || !client.api) throw new Error('Client must be set');
    if (!/^[0-9]{17,19}$/.test(applicationId)) {
      throw new Error('Application id must be a Discord Snowflake');
    }
    if (images.length > 2) {
      throw new Error('RichPresence can only have up to 2 external images');
    }
    if (images.some(image => !URL.canParse(image))) {
      throw new Error('Each image must be a valid URL.');
    }
    const res = await client.api.applications[applicationId]['external-assets'].post({
      data: {
        urls: images,
      },
    });
    return res;
  }
  toString() {
    return this.name;
  }
  _clone() {
    return Object.assign(Object.create(this), this);
  }
}
class SpotifyRPC extends RichPresence {
  constructor(client, options = {}) {
    if (!client) throw new Error("Class constructor SpotifyRPC cannot be invoked without 'client'");
    super(client, {
      name: 'Spotify',
      type: ActivityTypes.LISTENING,
      party: {
        id: `spotify:${client.user.id}`,
      },
      id: 'spotify:1',
      flags: 48, 
      ...options,
    });
    this.setup(options);
  }
  setup(options) {
    this.metadata = {
      album_id: options.metadata?.album_id || null,
      artist_ids: options.metadata?.artist_ids || [],
      context_uri: options.metadata?.context_uri || null,
    };
  }
  setSongId(id) {
    this.syncId = id;
    return this;
  }
  addArtistId(id) {
    if (!this.metadata.artist_ids) this.metadata.artist_ids = [];
    this.metadata.artist_ids.push(id);
    return this;
  }
  setArtistIds(...ids) {
    if (!ids?.length) {
      this.metadata.artist_ids = [];
      return this;
    }
    if (!this.metadata.artist_ids) this.metadata.artist_ids = [];
    ids.flat(2).forEach(id => this.metadata.artist_ids.push(id));
    return this;
  }
  setAlbumId(id) {
    this.metadata.album_id = id;
    this.metadata.context_uri = `spotify:album:${id}`;
    return this;
  }
  toJSON() {
    return super.toJSON({ id: false, emoji: false, platform: false, buttons: false });
  }
}
exports.Presence = Presence;
exports.Activity = Activity;
exports.RichPresenceAssets = RichPresenceAssets;
exports.CustomStatus = CustomStatus;
exports.RichPresence = RichPresence;
exports.SpotifyRPC = SpotifyRPC;
