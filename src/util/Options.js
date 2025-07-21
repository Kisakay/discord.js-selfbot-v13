'use strict';
const { UserAgent } = require('./Constants');
const Intents = require('./Intents');
class Options extends null {
  static createDefault() {
    return {
      DMChannelVoiceStatusSync: 0,
      captchaRetryLimit: 3,
      captchaSolver: () => {
        const err = new Error('CAPTCHA_SOLVER_NOT_IMPLEMENTED');
        err.cause =
          'You need to provide a captcha solver to use this feature\nEx: const sbClient = new Client({ captchaSolver: yourAsyncFunction })';
        throw err;
      },
      TOTPKey: null,
      closeTimeout: 5_000,
      waitGuildTimeout: 15_000,
      shardCount: 1,
      shards: [0],
      makeCache: this.cacheWithLimits(this.defaultMakeCacheSettings),
      messageCacheLifetime: 0,
      messageSweepInterval: 0,
      invalidRequestWarningInterval: 0,
      intents: Intents.ALL,
      partials: ['USER', 'CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION', 'GUILD_SCHEDULED_EVENT'], 
      restWsBridgeTimeout: 5_000,
      restRequestTimeout: 15_000,
      restGlobalRateLimit: 0,
      retryLimit: 1,
      restTimeOffset: 500,
      restSweepInterval: 60,
      failIfNotExists: true,
      presence: { status: 'online', since: 0, activities: [], afk: true },
      sweepers: {},
      ws: {
        capabilities: 0, 
        properties: {
          os: 'Windows',
          browser: 'Chrome',
          device: '',
          system_locale: 'en-US',
          has_client_mods: false,
          browser_user_agent: UserAgent,
          browser_version: '134.0.0.0',
          os_version: '10',
          referrer: '',
          referring_domain: '',
          referrer_current: '',
          referring_domain_current: '',
          release_channel: 'stable',
          client_build_number: 377668,
          client_event_source: null,
        },
        compress: false,
        client_state: {
          guild_versions: {},
        },
        version: 9,
        agent: {},
      },
      http: {
        agent: {},
        headers: {
          'User-Agent': UserAgent,
        },
        version: 9,
        api: 'https://discord.com/api',
        cdn: 'https://cdn.discordapp.com',
        invite: 'https://discord.gg',
        template: 'https://discord.new',
        scheduledEvent: 'https://discord.com/events',
      },
    };
  }
  static cacheWithLimits(settings = {}) {
    const { Collection } = require('@discordjs/collection');
    const LimitedCollection = require('./LimitedCollection');
    return manager => {
      const setting = settings[manager.name];
      if (setting == null) {
        return new Collection();
      }
      if (typeof setting === 'number') {
        if (setting === Infinity) {
          return new Collection();
        }
        return new LimitedCollection({ maxSize: setting });
      }
      const noSweeping =
        setting.sweepFilter == null ||
        setting.sweepInterval == null ||
        setting.sweepInterval <= 0 ||
        setting.sweepInterval === Infinity;
      const noLimit = setting.maxSize == null || setting.maxSize === Infinity;
      if (noSweeping && noLimit) {
        return new Collection();
      }
      return new LimitedCollection(setting);
    };
  }
  static cacheEverything() {
    const { Collection } = require('@discordjs/collection');
    return () => new Collection();
  }
  static get defaultMakeCacheSettings() {
    return {
      MessageManager: 200,
      ChannelManager: {
        sweepInterval: 3600,
        sweepFilter: require('./Util').archivedThreadSweepFilter(),
      },
      GuildChannelManager: {
        sweepInterval: 3600,
        sweepFilter: require('./Util').archivedThreadSweepFilter(),
      },
      ThreadManager: {
        sweepInterval: 3600,
        sweepFilter: require('./Util').archivedThreadSweepFilter(),
      },
    };
  }
}
Options.defaultSweeperSettings = {
  threads: {
    interval: 3600,
    lifetime: 14400,
  },
};
module.exports = Options;
