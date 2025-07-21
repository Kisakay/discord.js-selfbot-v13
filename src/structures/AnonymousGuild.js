'use strict';
const BaseGuild = require('./BaseGuild');
const { VerificationLevels, NSFWLevels } = require('../util/Constants');
class AnonymousGuild extends BaseGuild {
  constructor(client, data, immediatePatch = true) {
    super(client, data);
    if (immediatePatch) this._patch(data);
  }
  _patch(data) {
    if ('features' in data) this.features = data.features;
    if ('splash' in data) {
      this.splash = data.splash;
    }
    if ('banner' in data) {
      this.banner = data.banner;
    }
    if ('description' in data) {
      this.description = data.description;
    }
    if ('verification_level' in data) {
      this.verificationLevel = VerificationLevels[data.verification_level];
    }
    if ('vanity_url_code' in data) {
      this.vanityURLCode = data.vanity_url_code;
    }
    if ('nsfw_level' in data) {
      this.nsfwLevel = NSFWLevels[data.nsfw_level];
    }
    if ('premium_subscription_count' in data) {
      this.premiumSubscriptionCount = data.premium_subscription_count;
    } else {
      this.premiumSubscriptionCount ??= null;
    }
  }
  bannerURL({ format, size } = {}) {
    return this.banner && this.client.rest.cdn.Banner(this.id, this.banner, format, size);
  }
  splashURL({ format, size } = {}) {
    return this.splash && this.client.rest.cdn.Splash(this.id, this.splash, format, size);
  }
}
module.exports = AnonymousGuild;
