'use strict';
const Base = require('./Base');
const TextBasedChannel = require('./interfaces/TextBasedChannel');
const { Error } = require('../errors');
const { RelationshipTypes } = require('../util/Constants');
const SnowflakeUtil = require('../util/SnowflakeUtil');
const UserFlags = require('../util/UserFlags');
const Util = require('../util/Util');
class User extends Base {
  constructor(client, data) {
    super(client);
    this.id = data.id;
    this.bot = null;
    this.system = null;
    this.flags = null;
    this._patch(data);
  }
  _patch(data) {
    if ('username' in data) {
      this.username = data.username;
    } else {
      this.username ??= null;
    }
    if ('global_name' in data) {
      this.globalName = data.global_name;
    } else {
      this.globalName ??= null;
    }
    if ('bot' in data) {
      this.bot = Boolean(data.bot);
    } else if (!this.partial && typeof this.bot !== 'boolean') {
      this.bot = false;
    }
    if ('discriminator' in data) {
      this.discriminator = data.discriminator;
    } else {
      this.discriminator ??= null;
    }
    if ('avatar' in data) {
      this.avatar = data.avatar;
    } else {
      this.avatar ??= null;
    }
    if ('banner' in data) {
      this.banner = data.banner;
    } else if (this.banner !== null) {
      this.banner ??= undefined;
    }
    if ('banner_color' in data) {
      this.bannerColor = data.banner_color;
    } else if (this.bannerColor !== null) {
      this.bannerColor ??= undefined;
    }
    if ('accent_color' in data) {
      this.accentColor = data.accent_color;
    } else if (this.accentColor !== null) {
      this.accentColor ??= undefined;
    }
    if ('system' in data) {
      this.system = Boolean(data.system);
    } else if (!this.partial && typeof this.system !== 'boolean') {
      this.system = false;
    }
    if ('public_flags' in data) {
      this.flags = new UserFlags(data.public_flags);
    }
    if (data.avatar_decoration_data) {
      this.avatarDecorationData = {
        asset: data.avatar_decoration_data.asset,
        skuId: data.avatar_decoration_data.sku_id,
      };
    } else {
      this.avatarDecorationData = null;
    }
    if ('clan' in data && data.clan) {
      this.clan = {
        identityGuildId: data.clan.identity_guild_id,
        identityEnabled: data.clan.identity_enabled,
        tag: data.clan.tag,
        badge: data.clan.badge,
      };
    } else {
      this.clan ??= null;
    }
  }
  get avatarDecoration() {
    return this.avatarDecorationData?.asset || null;
  }
  get partial() {
    return typeof this.username !== 'string';
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  avatarURL({ format, size, dynamic } = {}) {
    if (!this.avatar) return null;
    return this.client.rest.cdn.Avatar(this.id, this.avatar, format, size, dynamic);
  }
  avatarDecorationURL({ size } = {}) {
    if (!this.avatarDecorationData) return null;
    return this.client.rest.cdn.AvatarDecoration(this.avatarDecorationData.asset, size);
  }
  clanBadgeURL() {
    if (!this.clan || !this.clan.identityGuildId || !this.clan.badge) return null;
    return this.client.rest.cdn.ClanBadge(this.clan.identityGuildId, this.clan.badge);
  }
  get defaultAvatarURL() {
    const index = this.discriminator === '0' ? Util.calculateUserDefaultAvatarIndex(this.id) : this.discriminator % 5;
    return this.client.rest.cdn.DefaultAvatar(index);
  }
  displayAvatarURL(options) {
    return this.avatarURL(options) ?? this.defaultAvatarURL;
  }
  get hexAccentColor() {
    if (typeof this.accentColor !== 'number') return this.accentColor;
    return `#${this.accentColor.toString(16).padStart(6, '0')}`;
  }
  bannerURL({ format, size, dynamic } = {}) {
    if (typeof this.banner === 'undefined') throw new Error('USER_BANNER_NOT_FETCHED');
    if (!this.banner) return null;
    return this.client.rest.cdn.Banner(this.id, this.banner, format, size, dynamic);
  }
  get tag() {
    return typeof this.username === 'string'
      ? this.discriminator === '0'
        ? this.username
        : `${this.username}#${this.discriminator}`
      : null;
  }
  get displayName() {
    return this.globalName ?? this.username;
  }
  get dmChannel() {
    return this.client.users.dmChannel(this.id);
  }
  createDM(force = false) {
    return this.client.users.createDM(this.id, force);
  }
  deleteDM() {
    return this.client.users.deleteDM(this.id);
  }
  equals(user) {
    return (
      user &&
      this.id === user.id &&
      this.username === user.username &&
      this.discriminator === user.discriminator &&
      this.globalName === user.globalName &&
      this.avatar === user.avatar &&
      this.flags?.bitfield === user.flags?.bitfield &&
      this.banner === user.banner &&
      this.accentColor === user.accentColor &&
      this.avatarDecorationData?.asset === user.avatarDecorationData?.asset &&
      this.avatarDecorationData?.skuId === user.avatarDecorationData?.skuId
    );
  }
  _equals(user) {
    return (
      user &&
      this.id === user.id &&
      this.username === user.username &&
      this.discriminator === user.discriminator &&
      this.globalName === user.global_name &&
      this.avatar === user.avatar &&
      this.flags?.bitfield === user.public_flags &&
      ('banner' in user ? this.banner === user.banner : true) &&
      ('accent_color' in user ? this.accentColor === user.accent_color : true) &&
      ('avatar_decoration_data' in user
        ? this.avatarDecorationData?.asset === user.avatar_decoration_data?.asset &&
          this.avatarDecorationData?.skuId === user.avatar_decoration_data?.sku_id
        : true)
    );
  }
  fetch(force = true) {
    return this.client.users.fetch(this.id, { force });
  }
  getProfile(guildId) {
    return this.client.api.users(this.id).profile.get({
      query: {
        with_mutual_guilds: true,
        with_mutual_friends: true,
        with_mutual_friends_count: true,
        guild_id: guildId,
      },
    });
  }
  toString() {
    return `<@${this.id}>`;
  }
  toJSON(...props) {
    const json = super.toJSON(
      {
        createdTimestamp: true,
        defaultAvatarURL: true,
        hexAccentColor: true,
        tag: true,
      },
      ...props,
    );
    json.avatarURL = this.avatarURL();
    json.displayAvatarURL = this.displayAvatarURL();
    json.bannerURL = this.banner ? this.bannerURL() : this.banner;
    return json;
  }
  async setNote(note = null) {
    await this.client.notes.updateNote(this.id, note);
    return this;
  }
  get note() {
    return this.client.notes.cache.get(this.id);
  }
  sendFriendRequest() {
    return this.client.relationships.sendFriendRequest(this);
  }
  deleteRelationship() {
    return this.client.relationships.deleteRelationship(this);
  }
  get relationship() {
    const i = this.client.relationships.cache.get(this.id) ?? 0;
    return RelationshipTypes[parseInt(i)];
  }
  get friendNickname() {
    return this.client.relationships.friendNicknames.get(this.id);
  }
}
TextBasedChannel.applyToClass(User);
module.exports = User;
