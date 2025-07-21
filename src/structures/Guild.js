'use strict';
const process = require('node:process');
const { Collection } = require('@discordjs/collection');
const AnonymousGuild = require('./AnonymousGuild');
const GuildAuditLogs = require('./GuildAuditLogs');
const GuildPreview = require('./GuildPreview');
const GuildTemplate = require('./GuildTemplate');
const Integration = require('./Integration');
const Webhook = require('./Webhook');
const WelcomeScreen = require('./WelcomeScreen');
const { Error } = require('../errors');
const AutoModerationRuleManager = require('../managers/AutoModerationRuleManager');
const GuildBanManager = require('../managers/GuildBanManager');
const GuildChannelManager = require('../managers/GuildChannelManager');
const GuildEmojiManager = require('../managers/GuildEmojiManager');
const GuildInviteManager = require('../managers/GuildInviteManager');
const GuildMemberManager = require('../managers/GuildMemberManager');
const GuildSettingManager = require('../managers/GuildSettingManager');
const GuildStickerManager = require('../managers/GuildStickerManager');
const PresenceManager = require('../managers/PresenceManager');
const RoleManager = require('../managers/RoleManager');
const StageInstanceManager = require('../managers/StageInstanceManager');
const {
  ChannelTypes,
  DefaultMessageNotificationLevels,
  VerificationLevels,
  ExplicitContentFilterLevels,
  Status,
  MFALevels,
  PremiumTiers,
} = require('../util/Constants');
const DataResolver = require('../util/DataResolver');
const SystemChannelFlags = require('../util/SystemChannelFlags');
const Util = require('../util/Util');
let deprecationEmittedForSetChannelPositions = false;
let deprecationEmittedForSetRolePositions = false;
let deprecationEmittedForDeleted = false;
let deprecationEmittedForMe = false;
const deletedGuilds = new WeakSet();
class Guild extends AnonymousGuild {
  constructor(client, data) {
    super(client, data, false);
    this.members = new GuildMemberManager(this);
    this.channels = new GuildChannelManager(this);
    this.bans = new GuildBanManager(this);
    this.roles = new RoleManager(this);
    this.presences = new PresenceManager(this.client);
    this.stageInstances = new StageInstanceManager(this);
    this.invites = new GuildInviteManager(this);
    this.autoModerationRules = new AutoModerationRuleManager(this);
    this.settings = new GuildSettingManager(this);
    if (!data) return;
    if (data.unavailable) {
      this.available = false;
    } else {
      this._patch(data);
      if (!data.channels) this.available = false;
    }
    this.shardId = data.shardId;
  }
  get deleted() {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Guild#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedGuilds.has(this);
  }
  set deleted(value) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Guild#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedGuilds.add(this);
    else deletedGuilds.delete(this);
  }
  get shard() {
    return this.client.ws.shards.get(this.shardId);
  }
  _patch(data) {
    super._patch(data);
    this.id = data.id;
    if ('name' in data) this.name = data.name;
    if ('icon' in data) this.icon = data.icon;
    if ('unavailable' in data) {
      this.available = !data.unavailable;
    } else {
      this.available ??= true;
    }
    if ('discovery_splash' in data) {
      this.discoverySplash = data.discovery_splash;
    }
    if ('member_count' in data) {
      this.memberCount = data.member_count;
    }
    if ('large' in data) {
      this.large = Boolean(data.large);
    }
    if ('premium_progress_bar_enabled' in data) {
      this.premiumProgressBarEnabled = data.premium_progress_bar_enabled;
    }
    if ('application_id' in data) {
      this.applicationId = data.application_id;
    }
    if ('afk_timeout' in data) {
      this.afkTimeout = data.afk_timeout;
    }
    if ('afk_channel_id' in data) {
      this.afkChannelId = data.afk_channel_id;
    }
    if ('system_channel_id' in data) {
      this.systemChannelId = data.system_channel_id;
    }
    if ('premium_tier' in data) {
      this.premiumTier = PremiumTiers[data.premium_tier];
    }
    if ('widget_enabled' in data) {
      this.widgetEnabled = data.widget_enabled;
    }
    if ('widget_channel_id' in data) {
      this.widgetChannelId = data.widget_channel_id;
    }
    if ('explicit_content_filter' in data) {
      this.explicitContentFilter = ExplicitContentFilterLevels[data.explicit_content_filter];
    }
    if ('mfa_level' in data) {
      this.mfaLevel = MFALevels[data.mfa_level];
    }
    if ('joined_at' in data) {
      this.joinedTimestamp = new Date(data.joined_at).getTime();
    }
    if ('default_message_notifications' in data) {
      this.defaultMessageNotifications = DefaultMessageNotificationLevels[data.default_message_notifications];
    }
    if ('system_channel_flags' in data) {
      this.systemChannelFlags = new SystemChannelFlags(data.system_channel_flags).freeze();
    }
    if ('max_members' in data) {
      this.maximumMembers = data.max_members;
    } else {
      this.maximumMembers ??= null;
    }
    if ('max_presences' in data) {
      this.maximumPresences = data.max_presences ?? 25_000;
    } else {
      this.maximumPresences ??= null;
    }
    if ('max_video_channel_users' in data) {
      this.maxVideoChannelUsers = data.max_video_channel_users;
    } else {
      this.maxVideoChannelUsers ??= null;
    }
    if ('max_stage_video_channel_users' in data) {
      this.maxStageVideoChannelUsers = data.max_stage_video_channel_users;
    } else {
      this.maxStageVideoChannelUsers ??= null;
    }
    if ('approximate_member_count' in data) {
      this.approximateMemberCount = data.approximate_member_count;
    } else {
      this.approximateMemberCount ??= null;
    }
    if ('approximate_presence_count' in data) {
      this.approximatePresenceCount = data.approximate_presence_count;
    } else {
      this.approximatePresenceCount ??= null;
    }
    this.vanityURLUses ??= null;
    if ('rules_channel_id' in data) {
      this.rulesChannelId = data.rules_channel_id;
    }
    if ('public_updates_channel_id' in data) {
      this.publicUpdatesChannelId = data.public_updates_channel_id;
    }
    if ('preferred_locale' in data) {
      this.preferredLocale = data.preferred_locale;
    }
    if ('safety_alerts_channel_id' in data) {
      this.safetyAlertsChannelId = data.safety_alerts_channel_id;
    } else {
      this.safetyAlertsChannelId ??= null;
    }
    if (data.channels) {
      this.channels.cache.clear();
      for (const rawChannel of data.channels) {
        this.client.channels._add(rawChannel, this);
      }
    }
    if (data.threads) {
      for (const rawThread of data.threads) {
        this.client.channels._add(rawThread, this);
      }
    }
    if (data.roles) {
      this.roles.cache.clear();
      for (const role of data.roles) this.roles._add(role);
    }
    if (data.members) {
      this.members.cache.clear();
      for (const guildUser of data.members) this.members._add(guildUser);
    }
    if ('owner_id' in data) {
      this.ownerId = data.owner_id;
    }
    if (data.presences) {
      for (const presence of data.presences) {
        this.presences._add(Object.assign(presence, { guild: this }));
      }
    }
    if (data.stage_instances) {
      this.stageInstances.cache.clear();
      for (const stageInstance of data.stage_instances) {
        this.stageInstances._add(stageInstance);
      }
    }
    if (!this.emojis) {
      this.emojis = new GuildEmojiManager(this);
      if (data.emojis) for (const emoji of data.emojis) this.emojis._add(emoji);
    } else if (data.emojis) {
      this.client.actions.GuildEmojisUpdate.handle({
        guild_id: this.id,
        emojis: data.emojis,
      });
    }
    if (!this.stickers) {
      this.stickers = new GuildStickerManager(this);
      if (data.stickers) for (const sticker of data.stickers) this.stickers._add(sticker);
    } else if (data.stickers) {
      this.client.actions.GuildStickersUpdate.handle({
        guild_id: this.id,
        stickers: data.stickers,
      });
    }
    if ('incidents_data' in data) {
      this.incidentsData = data.incidents_data && Util.transformAPIIncidentsData(data.incidents_data);
    } else {
      this.incidentsData ??= null;
    }
  }
  get joinedAt() {
    return new Date(this.joinedTimestamp);
  }
  discoverySplashURL({ format, size } = {}) {
    return this.discoverySplash && this.client.rest.cdn.DiscoverySplash(this.id, this.discoverySplash, format, size);
  }
  fetchOwner(options) {
    return this.members.fetch({ ...options, user: this.ownerId });
  }
  get afkChannel() {
    return this.client.channels.resolve(this.afkChannelId);
  }
  get systemChannel() {
    return this.client.channels.resolve(this.systemChannelId);
  }
  get safetyAlertsChannel() {
    return this.client.channels.resolve(this.safetyAlertsChannelId);
  }
  get widgetChannel() {
    return this.client.channels.resolve(this.widgetChannelId);
  }
  get rulesChannel() {
    return this.client.channels.resolve(this.rulesChannelId);
  }
  get publicUpdatesChannel() {
    return this.client.channels.resolve(this.publicUpdatesChannelId);
  }
  get me() {
    if (!deprecationEmittedForMe) {
      process.emitWarning('Guild#me is deprecated. Use Guild#members#me instead.', 'DeprecationWarning');
      deprecationEmittedForMe = true;
    }
    return this.members.me;
  }
  get maximumBitrate() {
    if (this.features.includes('VIP_REGIONS')) {
      return 384_000;
    }
    switch (PremiumTiers[this.premiumTier]) {
      case PremiumTiers.TIER_1:
        return 128_000;
      case PremiumTiers.TIER_2:
        return 256_000;
      case PremiumTiers.TIER_3:
        return 384_000;
      default:
        return 96_000;
    }
  }
  async fetchIntegrations() {
    const data = await this.client.api.guilds(this.id).integrations.get();
    return data.reduce(
      (collection, integration) => collection.set(integration.id, new Integration(this.client, integration, this)),
      new Collection(),
    );
  }
  async fetchTemplates() {
    const templates = await this.client.api.guilds(this.id).templates.get();
    return templates.reduce((col, data) => col.set(data.code, new GuildTemplate(this.client, data)), new Collection());
  }
  async fetchWelcomeScreen() {
    const data = await this.client.api.guilds(this.id, 'welcome-screen').get();
    return new WelcomeScreen(this, data);
  }
  async createTemplate(name, description) {
    const data = await this.client.api.guilds(this.id).templates.post({ data: { name, description } });
    return new GuildTemplate(this.client, data);
  }
  async fetchPreview() {
    const data = await this.client.api.guilds(this.id).preview.get();
    return new GuildPreview(this.client, data);
  }
  async fetchVanityData() {
    const data = await this.client.api.guilds(this.id, 'vanity-url').get();
    this.vanityURLCode = data.code;
    this.vanityURLUses = data.uses;
    return data;
  }
  async fetchWebhooks() {
    const apiHooks = await this.client.api.guilds(this.id).webhooks.get();
    const hooks = new Collection();
    for (const hook of apiHooks) hooks.set(hook.id, new Webhook(this.client, hook));
    return hooks;
  }
  fetchWidget() {
    return this.client.fetchGuildWidget(this.id);
  }
  async fetchWidgetSettings() {
    const data = await this.client.api.guilds(this.id).widget.get();
    this.widgetEnabled = data.enabled;
    this.widgetChannelId = data.channel_id;
    return {
      enabled: data.enabled,
      channel: data.channel_id ? this.channels.cache.get(data.channel_id) : null,
    };
  }
  async fetchAuditLogs({ before, after, limit, user, type } = {}) {
    const data = await this.client.api.guilds(this.id)['audit-logs'].get({
      query: {
        before: before?.id ?? before,
        after: after?.id ?? after,
        limit,
        user_id: this.client.users.resolveId(user),
        action_type: typeof type === 'string' ? GuildAuditLogs.Actions[type] : type,
      },
    });
    return GuildAuditLogs.build(this, data);
  }
  async edit(data, reason) {
    const _data = {};
    if (data.name) _data.name = data.name;
    if (typeof data.verificationLevel !== 'undefined') {
      _data.verification_level =
        typeof data.verificationLevel === 'number'
          ? data.verificationLevel
          : VerificationLevels[data.verificationLevel];
    }
    if (typeof data.afkChannel !== 'undefined') {
      _data.afk_channel_id = this.client.channels.resolveId(data.afkChannel);
    }
    if (typeof data.systemChannel !== 'undefined') {
      _data.system_channel_id = this.client.channels.resolveId(data.systemChannel);
    }
    if (data.afkTimeout) _data.afk_timeout = Number(data.afkTimeout);
    if (typeof data.icon !== 'undefined') _data.icon = await DataResolver.resolveImage(data.icon);
    if (data.owner) _data.owner_id = this.client.users.resolveId(data.owner);
    if (typeof data.splash !== 'undefined') _data.splash = await DataResolver.resolveImage(data.splash);
    if (typeof data.discoverySplash !== 'undefined') {
      _data.discovery_splash = await DataResolver.resolveImage(data.discoverySplash);
    }
    if (typeof data.banner !== 'undefined') _data.banner = await DataResolver.resolveImage(data.banner);
    if (typeof data.explicitContentFilter !== 'undefined') {
      _data.explicit_content_filter =
        typeof data.explicitContentFilter === 'number'
          ? data.explicitContentFilter
          : ExplicitContentFilterLevels[data.explicitContentFilter];
    }
    if (typeof data.defaultMessageNotifications !== 'undefined') {
      _data.default_message_notifications =
        typeof data.defaultMessageNotifications === 'number'
          ? data.defaultMessageNotifications
          : DefaultMessageNotificationLevels[data.defaultMessageNotifications];
    }
    if (typeof data.systemChannelFlags !== 'undefined') {
      _data.system_channel_flags = SystemChannelFlags.resolve(data.systemChannelFlags);
    }
    if (typeof data.rulesChannel !== 'undefined') {
      _data.rules_channel_id = this.client.channels.resolveId(data.rulesChannel);
    }
    if (typeof data.publicUpdatesChannel !== 'undefined') {
      _data.public_updates_channel_id = this.client.channels.resolveId(data.publicUpdatesChannel);
    }
    if (typeof data.features !== 'undefined') {
      _data.features = data.features;
    }
    if (typeof data.description !== 'undefined') {
      _data.description = data.description;
    }
    if (typeof data.preferredLocale !== 'undefined') _data.preferred_locale = data.preferredLocale;
    if (typeof data.safetyAlertsChannel !== 'undefined') {
      _data.safety_alerts_channel_id = this.client.channels.resolveId(data.safetyAlertsChannel);
    }
    if ('premiumProgressBarEnabled' in data) _data.premium_progress_bar_enabled = data.premiumProgressBarEnabled;
    const newData = await this.client.api.guilds(this.id).patch({ data: _data, reason });
    return this.client.actions.GuildUpdate.handle(newData).updated;
  }
  async editWelcomeScreen(data) {
    const { enabled, description, welcomeChannels } = data;
    const welcome_channels = welcomeChannels?.map(welcomeChannelData => {
      const emoji = this.emojis.resolve(welcomeChannelData.emoji);
      return {
        emoji_id: emoji?.id,
        emoji_name: emoji?.name ?? welcomeChannelData.emoji,
        channel_id: this.channels.resolveId(welcomeChannelData.channel),
        description: welcomeChannelData.description,
      };
    });
    const patchData = await this.client.api.guilds(this.id, 'welcome-screen').patch({
      data: {
        welcome_channels,
        description,
        enabled,
      },
    });
    return new WelcomeScreen(this, patchData);
  }
  setExplicitContentFilter(explicitContentFilter, reason) {
    return this.edit({ explicitContentFilter }, reason);
  }
  setDefaultMessageNotifications(defaultMessageNotifications, reason) {
    return this.edit({ defaultMessageNotifications }, reason);
  }
  setSystemChannelFlags(systemChannelFlags, reason) {
    return this.edit({ systemChannelFlags }, reason);
  }
  setName(name, reason) {
    return this.edit({ name }, reason);
  }
  setVerificationLevel(verificationLevel, reason) {
    return this.edit({ verificationLevel }, reason);
  }
  setAFKChannel(afkChannel, reason) {
    return this.edit({ afkChannel }, reason);
  }
  setSystemChannel(systemChannel, reason) {
    return this.edit({ systemChannel }, reason);
  }
  setAFKTimeout(afkTimeout, reason) {
    return this.edit({ afkTimeout }, reason);
  }
  setIcon(icon, reason) {
    return this.edit({ icon }, reason);
  }
  setOwner(owner, reason) {
    return this.edit({ owner }, reason);
  }
  setSplash(splash, reason) {
    return this.edit({ splash }, reason);
  }
  setDiscoverySplash(discoverySplash, reason) {
    return this.edit({ discoverySplash }, reason);
  }
  setBanner(banner, reason) {
    return this.edit({ banner }, reason);
  }
  setRulesChannel(rulesChannel, reason) {
    return this.edit({ rulesChannel }, reason);
  }
  setPublicUpdatesChannel(publicUpdatesChannel, reason) {
    return this.edit({ publicUpdatesChannel }, reason);
  }
  setPreferredLocale(preferredLocale, reason) {
    return this.edit({ preferredLocale }, reason);
  }
  setSafetyAlertsChannel(safetyAlertsChannel, reason) {
    return this.edit({ safetyAlertsChannel }, reason);
  }
  setPremiumProgressBarEnabled(enabled = true, reason) {
    return this.edit({ premiumProgressBarEnabled: enabled }, reason);
  }
  setChannelPositions(channelPositions) {
    if (!deprecationEmittedForSetChannelPositions) {
      process.emitWarning(
        'The Guild#setChannelPositions method is deprecated. Use GuildChannelManager#setPositions instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForSetChannelPositions = true;
    }
    return this.channels.setPositions(channelPositions);
  }
  setRolePositions(rolePositions) {
    if (!deprecationEmittedForSetRolePositions) {
      process.emitWarning(
        'The Guild#setRolePositions method is deprecated. Use RoleManager#setPositions instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForSetRolePositions = true;
    }
    return this.roles.setPositions(rolePositions);
  }
  async setWidgetSettings(settings, reason) {
    await this.client.api.guilds(this.id).widget.patch({
      data: {
        enabled: settings.enabled,
        channel_id: this.channels.resolveId(settings.channel),
      },
      reason,
    });
    return this;
  }
  disableInvites(disabled = true) {
    const features = this.features.filter(feature => feature !== 'INVITES_DISABLED');
    if (disabled) features.push('INVITES_DISABLED');
    return this.edit({ features });
  }
  setIncidentActions(incidentActions) {
    return this.client.guilds.setIncidentActions(this.id, incidentActions);
  }
  async leave() {
    if (this.ownerId === this.client.user.id) throw new Error('GUILD_OWNED');
    await this.client.api.users('@me').guilds(this.id).delete();
    return this.client.actions.GuildDelete.handle({ id: this.id }).guild;
  }
  async delete() {
    await this.client.api.guilds(this.id).delete();
    return this.client.actions.GuildDelete.handle({ id: this.id }).guild;
  }
  equals(guild) {
    return (
      guild &&
      guild instanceof this.constructor &&
      this.id === guild.id &&
      this.available === guild.available &&
      this.splash === guild.splash &&
      this.discoverySplash === guild.discoverySplash &&
      this.name === guild.name &&
      this.memberCount === guild.memberCount &&
      this.large === guild.large &&
      this.icon === guild.icon &&
      this.ownerId === guild.ownerId &&
      this.verificationLevel === guild.verificationLevel &&
      (this.features === guild.features ||
        (this.features.length === guild.features.length &&
          this.features.every((feat, i) => feat === guild.features[i])))
    );
  }
  toJSON() {
    const json = super.toJSON({
      available: false,
      createdTimestamp: true,
      nameAcronym: true,
      presences: false,
    });
    json.iconURL = this.iconURL();
    json.splashURL = this.splashURL();
    json.discoverySplashURL = this.discoverySplashURL();
    json.bannerURL = this.bannerURL();
    return json;
  }
  markAsRead() {
    return this.client.api.guilds(this.id).ack.post();
  }
  async setCommunity(stats = true, publicUpdatesChannel, rulesChannel, reason) {
    if (stats) {
      const everyoneRole = this.roles.everyone;
      if (everyoneRole.mentionable) {
        await everyoneRole.setMentionable(false, reason);
      }
      return this.edit(
        {
          defaultMessageNotifications: 'ONLY_MENTIONS',
          explicitContentFilter: 'ALL_MEMBERS',
          features: [...this.features, 'COMMUNITY'],
          publicUpdatesChannel: this.channels.resolveId(publicUpdatesChannel) || '1',
          rulesChannel: this.channels.resolveId(rulesChannel) || '1',
          verificationLevel: VerificationLevels[this.verificationLevel] < 1 ? 'LOW' : this.verificationLevel, 
        },
        reason,
      );
    } else {
      return this.edit(
        {
          publicUpdatesChannel: null,
          rulesChannel: null,
          features: this.features.filter(f => f !== 'COMMUNITY'),
          preferredLocale: this.preferredLocale,
          description: this.description,
        },
        reason,
      );
    }
  }
  topEmojis() {
    return new Promise((resolve, reject) => {
      this.client.api
        .guilds(this.id)
        ['top-emojis'].get()
        .then(data => {
          const emojis = new Collection();
          for (const emoji of data.items) {
            emojis.set(emoji.emoji_rank, this.emojis.cache.get(emoji.emoji_id));
          }
          resolve(emojis);
        })
        .catch(reject);
    });
  }
  async setVanityCode(code = '') {
    if (typeof code !== 'string') throw new TypeError('INVALID_VANITY_URL_CODE');
    const data = await this.client.api.guilds(this.id, 'vanity-url').patch({
      data: { code },
    });
    this.vanityURLCode = data.code;
    this.vanityURLUses = data.uses;
  }
  _sortedRoles() {
    return Util.discordSort(this.roles.cache);
  }
  _sortedChannels(channel) {
    const category = channel.type === ChannelTypes.GUILD_CATEGORY;
    return Util.discordSort(
      this.channels.cache.filter(
        c =>
          (['GUILD_TEXT', 'GUILD_NEWS', 'GUILD_STORE'].includes(channel.type)
            ? ['GUILD_TEXT', 'GUILD_NEWS', 'GUILD_STORE'].includes(c.type)
            : c.type === channel.type) &&
          (category || c.parent === channel.parent),
      ),
    );
  }
}
exports.Guild = Guild;
exports.deletedGuilds = deletedGuilds;
