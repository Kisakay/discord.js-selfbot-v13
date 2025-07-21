'use strict';
const process = require('node:process');
const { setTimeout } = require('node:timers');
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { Guild } = require('../structures/Guild');
const GuildChannel = require('../structures/GuildChannel');
const GuildEmoji = require('../structures/GuildEmoji');
const { GuildMember } = require('../structures/GuildMember');
const Invite = require('../structures/Invite');
const OAuth2Guild = require('../structures/OAuth2Guild');
const { Role } = require('../structures/Role');
const {
  ChannelTypes,
  Events,
  OverwriteTypes,
  VerificationLevels,
  DefaultMessageNotificationLevels,
  ExplicitContentFilterLevels,
  VideoQualityModes,
} = require('../util/Constants');
const DataResolver = require('../util/DataResolver');
const Permissions = require('../util/Permissions');
const SystemChannelFlags = require('../util/SystemChannelFlags');
const { resolveColor } = require('../util/Util');
const Util = require('../util/Util');
let cacheWarningEmitted = false;
class GuildManager extends CachedManager {
  constructor(client, iterable) {
    super(client, Guild, iterable);
    if (!cacheWarningEmitted && this._cache.constructor.name !== 'Collection') {
      cacheWarningEmitted = true;
      process.emitWarning(
        `Overriding the cache handling for ${this.constructor.name} is unsupported and breaks functionality.`,
        'UnsupportedCacheOverwriteWarning',
      );
    }
  }
  resolve(guild) {
    if (
      guild instanceof GuildChannel ||
      guild instanceof GuildMember ||
      guild instanceof GuildEmoji ||
      guild instanceof Role ||
      (guild instanceof Invite && guild.guild)
    ) {
      return super.resolve(guild.guild);
    }
    return super.resolve(guild);
  }
  resolveId(guild) {
    if (
      guild instanceof GuildChannel ||
      guild instanceof GuildMember ||
      guild instanceof GuildEmoji ||
      guild instanceof Role ||
      (guild instanceof Invite && guild.guild)
    ) {
      return super.resolveId(guild.guild.id);
    }
    return super.resolveId(guild);
  }
  async create(
    name,
    {
      afkChannelId,
      afkTimeout,
      channels = [],
      defaultMessageNotifications,
      explicitContentFilter,
      icon = null,
      roles = [],
      systemChannelId,
      systemChannelFlags,
      verificationLevel,
    } = {},
  ) {
    icon = await DataResolver.resolveImage(icon);
    if (typeof verificationLevel === 'string') {
      verificationLevel = VerificationLevels[verificationLevel];
    }
    if (typeof defaultMessageNotifications === 'string') {
      defaultMessageNotifications = DefaultMessageNotificationLevels[defaultMessageNotifications];
    }
    if (typeof explicitContentFilter === 'string') {
      explicitContentFilter = ExplicitContentFilterLevels[explicitContentFilter];
    }
    for (const channel of channels) {
      channel.type &&= typeof channel.type === 'number' ? channel.type : ChannelTypes[channel.type];
      channel.parent_id = channel.parentId;
      delete channel.parentId;
      channel.user_limit = channel.userLimit;
      delete channel.userLimit;
      channel.rate_limit_per_user = channel.rateLimitPerUser;
      delete channel.rateLimitPerUser;
      channel.rtc_region = channel.rtcRegion;
      delete channel.rtcRegion;
      channel.video_quality_mode =
        typeof channel.videoQualityMode === 'string'
          ? VideoQualityModes[channel.videoQualityMode]
          : channel.videoQualityMode;
      delete channel.videoQualityMode;
      if (!channel.permissionOverwrites) continue;
      for (const overwrite of channel.permissionOverwrites) {
        if (typeof overwrite.type === 'string') {
          overwrite.type = OverwriteTypes[overwrite.type];
        }
        overwrite.allow &&= Permissions.resolve(overwrite.allow).toString();
        overwrite.deny &&= Permissions.resolve(overwrite.deny).toString();
      }
      channel.permission_overwrites = channel.permissionOverwrites;
      delete channel.permissionOverwrites;
    }
    for (const role of roles) {
      role.color &&= resolveColor(role.color);
      role.permissions &&= Permissions.resolve(role.permissions).toString();
    }
    systemChannelFlags &&= SystemChannelFlags.resolve(systemChannelFlags);
    const data = await this.client.api.guilds.post({
      data: {
        name,
        icon,
        verification_level: verificationLevel,
        default_message_notifications: defaultMessageNotifications,
        explicit_content_filter: explicitContentFilter,
        roles,
        channels,
        afk_channel_id: afkChannelId,
        afk_timeout: afkTimeout,
        system_channel_id: systemChannelId,
        system_channel_flags: systemChannelFlags,
        guild_template_code: '2TffvPucqHkN', 
      },
    });
    if (this.client.guilds.cache.has(data.id)) return this.client.guilds.cache.get(data.id);
    return new Promise(resolve => {
      const handleGuild = guild => {
        if (guild.id === data.id) {
          clearTimeout(timeout);
          this.client.removeListener(Events.GUILD_CREATE, handleGuild);
          this.client.decrementMaxListeners();
          resolve(guild);
        }
      };
      this.client.incrementMaxListeners();
      this.client.on(Events.GUILD_CREATE, handleGuild);
      const timeout = setTimeout(() => {
        this.client.removeListener(Events.GUILD_CREATE, handleGuild);
        this.client.decrementMaxListeners();
        resolve(this.client.guilds._add(data));
      }, 10_000).unref();
    });
  }
  async fetch(options = {}) {
    const id = this.resolveId(options) ?? this.resolveId(options.guild);
    if (id) {
      if (!options.force) {
        const existing = this.cache.get(id);
        if (existing) return existing;
      }
      const data = await this.client.api.guilds(id).get({ query: { with_counts: options.withCounts ?? true } });
      return this._add(data, options.cache);
    }
    const data = await this.client.api.users('@me').guilds.get({ query: options });
    return data.reduce((coll, guild) => coll.set(guild.id, new OAuth2Guild(this.client, guild)), new Collection());
  }
  async setIncidentActions(guild, { invitesDisabledUntil, dmsDisabledUntil }) {
    const guildId = this.resolveId(guild);
    const data = await this.client.api.guilds(guildId)['incident-actions'].put({
      data: {
        invites_disabled_until: invitesDisabledUntil && new Date(invitesDisabledUntil).toISOString(),
        dms_disabled_until: dmsDisabledUntil && new Date(dmsDisabledUntil).toISOString(),
      },
    });
    const parsedData = Util.transformAPIIncidentsData(data);
    const resolvedGuild = this.resolve(guild);
    if (resolvedGuild) {
      resolvedGuild.incidentsData = parsedData;
    }
    return parsedData;
  }
}
module.exports = GuildManager;
