'use strict';
const process = require('node:process');
const Base = require('./Base');
const TextBasedChannel = require('./interfaces/TextBasedChannel');
const { Error } = require('../errors');
const GuildMemberRoleManager = require('../managers/GuildMemberRoleManager');
const GuildMemberFlags = require('../util/GuildMemberFlags');
const Permissions = require('../util/Permissions');
const deletedGuildMembers = new WeakSet();
let deprecationEmittedForDeleted = false;
class GuildMember extends Base {
  constructor(client, data, guild) {
    super(client);
    this.guild = guild;
    this.joinedTimestamp = null;
    this.premiumSinceTimestamp = null;
    this.nickname = null;
    this.pending = false;
    this.communicationDisabledUntilTimestamp = null;
    this._roles = [];
    if (data) this._patch(data);
  }
  _patch(data) {
    if ('user' in data) {
      this.user = this.client.users._add(data.user, true);
    }
    if ('nick' in data) this.nickname = data.nick;
    if ('avatar' in data) {
      this.avatar = data.avatar;
    } else if (typeof this.avatar !== 'string') {
      this.avatar = null;
    }
    if ('banner' in data) {
      this.banner = data.banner;
    } else {
      this.banner ??= null;
    }
    if ('joined_at' in data) this.joinedTimestamp = new Date(data.joined_at).getTime();
    if ('premium_since' in data) {
      this.premiumSinceTimestamp = data.premium_since ? new Date(data.premium_since).getTime() : null;
    }
    if ('roles' in data) this._roles = data.roles;
    this.pending = data.pending ?? false;
    if ('communication_disabled_until' in data) {
      this.communicationDisabledUntilTimestamp =
        data.communication_disabled_until && Date.parse(data.communication_disabled_until);
    }
    if ('flags' in data) {
      this.flags = new GuildMemberFlags(data.flags).freeze();
    } else {
      this.flags ??= new GuildMemberFlags().freeze();
    }
  }
  _clone() {
    const clone = super._clone();
    clone._roles = this._roles.slice();
    return clone;
  }
  get deleted() {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'GuildMember#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedGuildMembers.has(this);
  }
  set deleted(value) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'GuildMember#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedGuildMembers.add(this);
    else deletedGuildMembers.delete(this);
  }
  get partial() {
    return this.joinedTimestamp === null;
  }
  get roles() {
    return new GuildMemberRoleManager(this);
  }
  avatarURL({ format, size, dynamic } = {}) {
    if (!this.avatar) return null;
    return this.client.rest.cdn.GuildMemberAvatar(this.guild.id, this.id, this.avatar, format, size, dynamic);
  }
  bannerURL({ format, size, dynamic } = {}) {
    return (
      this.banner && this.client.rest.cdn.GuildMemberBanner(this.guild.id, this.id, this.banner, format, size, dynamic)
    );
  }
  displayAvatarURL(options) {
    return this.avatarURL(options) ?? this.user.displayAvatarURL(options);
  }
  displayBannerURL(options) {
    return this.bannerURL(options) ?? this.user.bannerURL(options);
  }
  get joinedAt() {
    return this.joinedTimestamp ? new Date(this.joinedTimestamp) : null;
  }
  get communicationDisabledUntil() {
    return this.communicationDisabledUntilTimestamp && new Date(this.communicationDisabledUntilTimestamp);
  }
  get premiumSince() {
    return this.premiumSinceTimestamp ? new Date(this.premiumSinceTimestamp) : null;
  }
  get presence() {
    return this.guild.presences.cache.get(this.id) ?? null;
  }
  get displayColor() {
    return this.roles.color?.color ?? 0;
  }
  get displayHexColor() {
    return this.roles.color?.hexColor ?? '#000000';
  }
  get id() {
    return this.user.id;
  }
  get displayName() {
    return this.nickname ?? this.user.displayName;
  }
  get permissions() {
    if (this.user.id === this.guild.ownerId) return new Permissions(Permissions.ALL).freeze();
    return new Permissions(this.roles.cache.map(role => role.permissions)).freeze();
  }
  get manageable() {
    if (this.user.id === this.guild.ownerId) return false;
    if (this.user.id === this.client.user.id) return false;
    if (this.client.user.id === this.guild.ownerId) return true;
    if (!this.guild.members.me) throw new Error('GUILD_UNCACHED_ME');
    return this.guild.members.me.roles.highest.comparePositionTo(this.roles.highest) > 0;
  }
  get kickable() {
    return this.manageable && this.guild.members.me.permissions.has(Permissions.FLAGS.KICK_MEMBERS);
  }
  get bannable() {
    return this.manageable && this.guild.members.me.permissions.has(Permissions.FLAGS.BAN_MEMBERS);
  }
  get moderatable() {
    return (
      !this.permissions.has(Permissions.FLAGS.ADMINISTRATOR) &&
      this.manageable &&
      (this.guild.members.me?.permissions.has(Permissions.FLAGS.MODERATE_MEMBERS) ?? false)
    );
  }
  isCommunicationDisabled() {
    return this.communicationDisabledUntilTimestamp > Date.now();
  }
  permissionsIn(channel) {
    channel = this.guild.channels.resolve(channel);
    if (!channel) throw new Error('GUILD_CHANNEL_RESOLVE');
    return channel.permissionsFor(this);
  }
  edit(data, reason) {
    return this.guild.members.edit(this, data, reason);
  }
  setNickname(nick, reason) {
    return this.edit({ nick }, reason);
  }
  setFlags(flags, reason) {
    return this.edit({ flags, reason });
  }
  createDM(force = false) {
    return this.user.createDM(force);
  }
  deleteDM() {
    return this.user.deleteDM();
  }
  kick(reason) {
    return this.guild.members.kick(this, reason);
  }
  ban(options) {
    return this.guild.bans.create(this, options);
  }
  disableCommunicationUntil(communicationDisabledUntil, reason) {
    return this.edit({ communicationDisabledUntil }, reason);
  }
  timeout(timeout, reason) {
    return this.disableCommunicationUntil(timeout && Date.now() + timeout, reason);
  }
  fetch(force = true) {
    return this.guild.members.fetch({ user: this.id, cache: true, force });
  }
  equals(member) {
    return (
      member instanceof this.constructor &&
      this.id === member.id &&
      this.partial === member.partial &&
      this.guild.id === member.guild.id &&
      this.joinedTimestamp === member.joinedTimestamp &&
      this.nickname === member.nickname &&
      this.avatar === member.avatar &&
      this.banner === member.banner &&
      this.pending === member.pending &&
      this.communicationDisabledUntilTimestamp === member.communicationDisabledUntilTimestamp &&
      this.flags.equals(member.flags) &&
      (this._roles === member._roles ||
        (this._roles.length === member._roles.length && this._roles.every((role, i) => role === member._roles[i])))
    );
  }
  toString() {
    return `<@${this.nickname ? '!' : ''}${this.user.id}>`;
  }
  toJSON() {
    const json = super.toJSON({
      guild: 'guildId',
      user: 'userId',
      displayName: true,
      roles: true,
    });
    json.avatarURL = this.avatarURL();
    json.bannerURL = this.bannerURL();
    json.displayAvatarURL = this.displayAvatarURL();
    json.displayBannerURL = this.displayBannerURL();
    return json;
  }
  setAvatar(avatar) {
    return this.edit({ avatar });
  }
  setBanner(banner) {
    return this.edit({ banner });
  }
  setAboutMe(bio = null) {
    return this.edit({ bio });
  }
}
TextBasedChannel.applyToClass(GuildMember);
exports.GuildMember = GuildMember;
exports.deletedGuildMembers = deletedGuildMembers;
