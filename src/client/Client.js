'use strict';
const process = require('node:process');
const { setInterval } = require('node:timers');
const { setTimeout } = require('node:timers');
const { Collection } = require('@discordjs/collection');
const BaseClient = require('./BaseClient');
const ActionsManager = require('./actions/ActionsManager');
const WebSocketManager = require('./websocket/WebSocketManager');
const { Error, TypeError } = require('../errors');
const BaseGuildEmojiManager = require('../managers/BaseGuildEmojiManager');
const BillingManager = require('../managers/BillingManager');
const ChannelManager = require('../managers/ChannelManager');
const ClientUserSettingManager = require('../managers/ClientUserSettingManager');
const GuildManager = require('../managers/GuildManager');
const PresenceManager = require('../managers/PresenceManager');
const RelationshipManager = require('../managers/RelationshipManager');
const SessionManager = require('../managers/SessionManager');
const UserManager = require('../managers/UserManager');
const UserNoteManager = require('../managers/UserNoteManager');
const ShardClientUtil = require('../sharding/ShardClientUtil');
const ClientPresence = require('../structures/ClientPresence');
const GuildPreview = require('../structures/GuildPreview');
const GuildTemplate = require('../structures/GuildTemplate');
const Invite = require('../structures/Invite');
const { Sticker } = require('../structures/Sticker');
const StickerPack = require('../structures/StickerPack');
const Webhook = require('../structures/Webhook');
const Widget = require('../structures/Widget');
const { Events, Status } = require('../util/Constants');
const DataResolver = require('../util/DataResolver');
const Intents = require('../util/Intents');
const Sweepers = require('../util/Sweepers');
const TOTP = require('../util/Totp');
class Client extends BaseClient {
  constructor(options) {
    super(options);
    this._validateOptions();
    this._cleanups = new Set();
    this._finalizers = new FinalizationRegistry(this._finalize.bind(this));
    this.ws = new WebSocketManager(this);
    this.actions = new ActionsManager(this);
    this.shard = process.env.SHARDING_MANAGER
      ? ShardClientUtil.singleton(this, process.env.SHARDING_MANAGER_MODE)
      : null;
    this.users = new UserManager(this);
    this.guilds = new GuildManager(this);
    this.channels = new ChannelManager(this);
    this.sweepers = new Sweepers(this, this.options.sweepers);
    this.presence = new ClientPresence(this, this.options.presence);
    this.presences = new PresenceManager(this);
    this.notes = new UserNoteManager(this);
    this.relationships = new RelationshipManager(this);
    this.billing = new BillingManager(this);
    this.sessions = new SessionManager(this);
    this.settings = new ClientUserSettingManager(this);
    Object.defineProperty(this, 'token', { writable: true });
    if (!this.token && 'DISCORD_TOKEN' in process.env) {
      this.token = process.env.DISCORD_TOKEN;
    } else {
      this.token = null;
    }
    this.user = null;
    this.readyAt = null;
    if (this.options.messageSweepInterval > 0) {
      process.emitWarning(
        'The message sweeping client options are deprecated, use the global sweepers instead.',
        'DeprecationWarning',
      );
      this.sweepMessageInterval = setInterval(
        this.sweepMessages.bind(this),
        this.options.messageSweepInterval * 1_000,
      ).unref();
    }
  }
  get emojis() {
    const emojis = new BaseGuildEmojiManager(this);
    for (const guild of this.guilds.cache.values()) {
      if (guild.available) for (const emoji of guild.emojis.cache.values()) emojis.cache.set(emoji.id, emoji);
    }
    return emojis;
  }
  get readyTimestamp() {
    return this.readyAt?.getTime() ?? null;
  }
  get uptime() {
    return this.readyAt ? Date.now() - this.readyAt : null;
  }
  async login(token = this.token) {
    if (!token || typeof token !== 'string') throw new Error('TOKEN_INVALID');
    this.token = token = token.replace(/^(Bot|Bearer)\s*/i, '');
    this.emit(
      Events.DEBUG,
      `
      Logging on with a user token is unfortunately against the Discord
      \`Terms of Service\` <https://support.discord.com/hc/en-us/articles/115002192352>
      and doing so might potentially get your account banned.
      Use this at your own risk.`,
    );
    this.emit(
      Events.DEBUG,
      `Provided token: ${token
        .split('.')
        .map((val, i) => (i > 1 ? val.replace(/./g, '*') : val))
        .join('.')}`,
    );
    if (this.options.presence) {
      this.options.ws.presence = this.presence._parse(this.options.presence);
    }
    this.emit(Events.DEBUG, 'Preparing to connect to the gateway...');
    try {
      await this.ws.connect();
      return this.token;
    } catch (error) {
      this.destroy();
      throw error;
    }
  }
  async passLogin(email, password) {
    const initial = await this.api.auth.login.post({
      auth: false,
      versioned: true,
      data: { gift_code_sku_id: null, login_source: null, undelete: false, login: email, password },
    });
    if ('token' in initial) {
      return this.login(initial.token);
    } else if ('ticket' in initial) {
      if (!this.options.TOTPKey) throw new Error('TOTPKEY_MISSING');
      const { otp } = await TOTP.generate(this.options.TOTPKey);
      const totp = await this.api.auth.mfa.totp.post({
        auth: false,
        versioned: true,
        data: { gift_code_sku_id: null, login_source: null, code: otp, ticket: initial.ticket },
      });
      if ('token' in totp) {
        return this.login(totp.token);
      }
    }
    return null;
  }
  isReady() {
    return !this.ws.destroyed && this.ws.status === Status.READY;
  }
  destroy() {
    super.destroy();
    for (const fn of this._cleanups) fn();
    this._cleanups.clear();
    if (this.sweepMessageInterval) clearInterval(this.sweepMessageInterval);
    this.sweepers.destroy();
    this.ws.destroy();
    this.token = null;
  }
  async logout() {
    await this.api.auth.logout.post({
      data: {
        provider: null,
        voip_provider: null,
      },
    });
    return this.destroy();
  }
  async fetchInvite(invite, options) {
    const code = DataResolver.resolveInviteCode(invite);
    const data = await this.api.invites(code).get({
      query: { with_counts: true, with_expiration: true, guild_scheduled_event_id: options?.guildScheduledEventId },
    });
    return new Invite(this, data);
  }
  async fetchGuildTemplate(template) {
    const code = DataResolver.resolveGuildTemplateCode(template);
    const data = await this.api.guilds.templates(code).get();
    return new GuildTemplate(this, data);
  }
  async fetchWebhook(id, token) {
    const data = await this.api.webhooks(id, token).get();
    return new Webhook(this, { token, ...data });
  }
  async fetchSticker(id) {
    const data = await this.api.stickers(id).get();
    return new Sticker(this, data);
  }
  async fetchPremiumStickerPacks() {
    const data = await this.api('sticker-packs').get();
    return new Collection(data.sticker_packs.map(p => [p.id, new StickerPack(this, p)]));
  }
  _finalize({ cleanup, message, name }) {
    try {
      cleanup();
      this._cleanups.delete(cleanup);
      if (message) {
        this.emit(Events.DEBUG, message);
      }
    } catch {
      this.emit(Events.DEBUG, `Garbage collection failed on ${name ?? 'an unknown item'}.`);
    }
  }
  sweepMessages(lifetime = this.options.messageCacheLifetime) {
    if (typeof lifetime !== 'number' || isNaN(lifetime)) {
      throw new TypeError('INVALID_TYPE', 'lifetime', 'number');
    }
    if (lifetime <= 0) {
      this.emit(Events.DEBUG, "Didn't sweep messages - lifetime is unlimited");
      return -1;
    }
    const messages = this.sweepers.sweepMessages(Sweepers.outdatedMessageSweepFilter(lifetime)());
    this.emit(Events.DEBUG, `Swept ${messages} messages older than ${lifetime} seconds`);
    return messages;
  }
  async fetchGuildPreview(guild) {
    const id = this.guilds.resolveId(guild);
    if (!id) throw new TypeError('INVALID_TYPE', 'guild', 'GuildResolvable');
    const data = await this.api.guilds(id).preview.get();
    return new GuildPreview(this, data);
  }
  async fetchGuildWidget(guild) {
    const id = this.guilds.resolveId(guild);
    if (!id) throw new TypeError('INVALID_TYPE', 'guild', 'GuildResolvable');
    const data = await this.api.guilds(id, 'widget.json').get();
    return new Widget(this, data);
  }
  async refreshAttachmentURL(...urls) {
    urls = urls.map(url => {
      const urlObject = new URL(url);
      urlObject.search = '';
      return urlObject.toString();
    });
    const data = await this.api.attachments('refresh-urls').post({
      data: { attachment_urls: urls },
    });
    return data.refreshed_urls;
  }
  sleep(timeout) {
    return new Promise(r => setTimeout(r, timeout));
  }
  toJSON() {
    return super.toJSON({
      readyAt: false,
    });
  }
  get sessionId() {
    return this.ws.shards.first()?.sessionId;
  }
  async acceptInvite(invite, options = { bypassOnboarding: true, bypassVerify: true }) {
    const code = DataResolver.resolveInviteCode(invite);
    if (!code) throw new Error('INVITE_RESOLVE_CODE');
    const i = await this.fetchInvite(code);
    if (i.guild?.id && this.guilds.cache.has(i.guild?.id)) return this.guilds.cache.get(i.guild?.id);
    if (this.channels.cache.has(i.channelId)) return this.channels.cache.get(i.channelId);
    const data = await this.api.invites(code).post({
      DiscordContext: { location: 'Markdown Link' },
      data: {
        session_id: this.sessionId,
      },
    });
    this.emit(Events.DEBUG, `[Invite > Guild ${i.guild?.id}] Joined`);
    if (i.guild?.id) {
      const guild = this.guilds.cache.get(i.guild?.id);
      if (i.flags.has('GUEST')) {
        this.emit(Events.DEBUG, `[Invite > Guild ${i.guild?.id}] Guest invite`);
        return guild;
      }
      if (options.bypassOnboarding) {
        const onboardingData = await this.api.guilds[i.guild?.id].onboarding.get();
        if (onboardingData.enabled) {
          const prompts = onboardingData.prompts.filter(o => o.in_onboarding);
          if (prompts.length) {
            const onboarding_prompts_seen = {};
            const onboarding_responses = [];
            const onboarding_responses_seen = {};
            const currentDate = Date.now();
            prompts.forEach(prompt => {
              onboarding_prompts_seen[prompt.id] = currentDate;
              if (prompt.required) onboarding_responses.push(prompt.options[0].id);
              prompt.options.forEach(option => {
                onboarding_responses_seen[option.id] = currentDate;
              });
            });
            await this.api.guilds[i.guild?.id]['onboarding-responses'].post({
              data: {
                onboarding_prompts_seen,
                onboarding_responses,
                onboarding_responses_seen,
              },
            });
            this.emit(Events.DEBUG, `[Invite > Guild ${i.guild?.id}] Bypassed onboarding`);
          }
        }
      }
      if (data.show_verification_form && options.bypassVerify) {
        if (i.guild.verificationLevel == 'VERY_HIGH' && !this.user.phone) {
          this.emit(Events.DEBUG, `[Invite > Guild ${i.guild?.id}] Cannot bypass verify (Phone required)`);
          return this.guilds.cache.get(i.guild?.id);
        }
        if (i.guild.verificationLevel !== 'NONE' && !this.user.email) {
          this.emit(Events.DEBUG, `[Invite > Guild ${i.guild?.id}] Cannot bypass verify (Email required)`);
          return this.guilds.cache.get(i.guild?.id);
        }
        const getForm = await this.api
          .guilds(i.guild?.id)
          ['member-verification'].get({ query: { with_guild: false, invite_code: this.code } })
          .catch(() => {});
        if (getForm && getForm.form_fields[0]) {
          const form = Object.assign(getForm.form_fields[0], { response: true });
          await this.api
            .guilds(i.guild?.id)
            .requests['@me'].put({ data: { form_fields: [form], version: getForm.version } });
          this.emit(Events.DEBUG, `[Invite > Guild ${i.guild?.id}] Bypassed verify`);
        }
      }
      return guild;
    } else {
      return this.channels.cache.has(i.channelId || data.channel?.id);
    }
  }
  redeemNitro(nitro, channel, paymentSourceId) {
    if (typeof nitro !== 'string') throw new Error('INVALID_NITRO');
    const nitroCode =
      nitro.match(/(discord.gift|discord.com|discordapp.com\/gifts)\/(\w{16,25})/) ||
      nitro.match(/(discord\.gift\/|discord\.com\/gifts\/|discordapp\.com\/gifts\/)(\w+)/);
    if (!nitroCode) return false;
    const code = nitroCode[2];
    channel = this.channels.resolveId(channel);
    return this.api.entitlements['gift-codes'](code).redeem.post({
      auth: true,
      data: { channel_id: channel || null, payment_source_id: paymentSourceId || null },
    });
  }
  authorizeURL(urlOAuth2, options = {}) {
    const url = new URL(urlOAuth2);
    if (!/^https:\/\/(?:canary\.|ptb\.)?discord\.com(?:\/api(?:\/v\d{1,2})?)?\/oauth2\/authorize\?/.test(urlOAuth2)) {
      throw new Error('INVALID_URL', urlOAuth2);
    }
    const searchParams = Object.fromEntries(url.searchParams);
    options = {
      authorize: true,
      permissions: '0',
      integration_type: 0,
      location_context: {
        guild_id: '10000',
        channel_id: '10000',
        channel_type: 10000,
      },
      ...searchParams,
      ...options,
    };
    delete searchParams.permissions;
    delete searchParams.integration_type;
    delete searchParams.guild_id;
    return this.api.oauth2.authorize.post({
      query: searchParams,
      data: options,
    });
  }
  installUserApps(applicationId) {
    return this.api
      .applications(applicationId)
      .public.get({
        query: {
          with_guild: false,
        },
      })
      .then(rawData => {
        const installTypes = rawData.integration_types_config['1'];
        if (installTypes) {
          return this.api.oauth2.authorize.post({
            query: {
              client_id: applicationId,
              scope: installTypes.oauth2_install_params.scopes.join(' '),
            },
            data: {
              permissions: '0',
              authorize: true,
              integration_type: 1,
            },
          });
        } else {
          return false;
        }
      });
  }
  deauthorize(applicationId) {
    return this.api.oauth2.tokens
      .get()
      .then(data => data.find(o => o.application.id == applicationId))
      .then(o => this.api.oauth2.tokens(o.id).delete());
  }
  _eval(script) {
    return eval(script);
  }
  _validateOptions(options = this.options) {
    if (typeof options.makeCache !== 'function') {
      throw new TypeError('CLIENT_INVALID_OPTION', 'makeCache', 'a function');
    }
    if (typeof options.messageCacheLifetime !== 'number' || isNaN(options.messageCacheLifetime)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'The messageCacheLifetime', 'a number');
    }
    if (typeof options.messageSweepInterval !== 'number' || isNaN(options.messageSweepInterval)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'messageSweepInterval', 'a number');
    }
    if (typeof options.sweepers !== 'object' || options.sweepers === null) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'sweepers', 'an object');
    }
    if (typeof options.invalidRequestWarningInterval !== 'number' || isNaN(options.invalidRequestWarningInterval)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'invalidRequestWarningInterval', 'a number');
    }
    if (!Array.isArray(options.partials)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'partials', 'an Array');
    }
    if (typeof options.waitGuildTimeout !== 'number' || isNaN(options.waitGuildTimeout)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'waitGuildTimeout', 'a number');
    }
    if (typeof options.restWsBridgeTimeout !== 'number' || isNaN(options.restWsBridgeTimeout)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'restWsBridgeTimeout', 'a number');
    }
    if (typeof options.restRequestTimeout !== 'number' || isNaN(options.restRequestTimeout)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'restRequestTimeout', 'a number');
    }
    if (typeof options.restGlobalRateLimit !== 'number' || isNaN(options.restGlobalRateLimit)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'restGlobalRateLimit', 'a number');
    }
    if (typeof options.restSweepInterval !== 'number' || isNaN(options.restSweepInterval)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'restSweepInterval', 'a number');
    }
    if (typeof options.retryLimit !== 'number' || isNaN(options.retryLimit)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'retryLimit', 'a number');
    }
    if (typeof options.failIfNotExists !== 'boolean') {
      throw new TypeError('CLIENT_INVALID_OPTION', 'failIfNotExists', 'a boolean');
    }
    if (
      typeof options.rejectOnRateLimit !== 'undefined' &&
      !(typeof options.rejectOnRateLimit === 'function' || Array.isArray(options.rejectOnRateLimit))
    ) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'rejectOnRateLimit', 'an array or a function');
    }
    this.options.shardCount = 1;
    this.options.shards = [0];
    this.options.intents = Intents.ALL;
  }
}
module.exports = Client;
