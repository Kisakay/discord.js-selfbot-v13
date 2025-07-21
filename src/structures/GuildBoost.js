'use strict';
const Base = require('./Base');
class GuildBoost extends Base {
  constructor(client, data) {
    super(client);
    this._patch(data);
  }
  _patch(data) {
    if ('id' in data) {
      this.id = data.id;
    }
    if ('subscription_id' in data) {
      this.subscriptionId = data.subscription_id;
    }
    if (typeof data.premium_guild_subscription === 'object' && data.premium_guild_subscription !== null) {
      this.premiumGuildSubscriptionId = data.premium_guild_subscription.id;
      this.guildId = data.premium_guild_subscription.guild_id;
      this.ended = data.premium_guild_subscription.ended;
    }
    if ('canceled' in data) {
      this.canceled = data.canceled;
    }
    if ('cooldown_ends_at' in data) {
      this.cooldownEndsAt = new Date(data.cooldown_ends_at);
    }
  }
  get guilld() {
    return this.client.guilds.cache.get(this.guildId);
  }
  async unsubscribe() {
    if (!this.guildId) throw new Error('BOOST_UNUSED');
    if (!this.premiumGuildSubscriptionId) throw new Error('BOOST_UNCACHED');
    await this.client.api.guilds(this.guildId).premium.subscriptions(this.premiumGuildSubscriptionId).delete();
    this.guildId = null;
    this.premiumGuildSubscriptionId = null;
    this.ended = null;
    return this;
  }
  async subscribe(guild) {
    if (this.guildId || this.premiumGuildSubscriptionId) throw new Error('BOOST_USED');
    const id = this.client.guilds.resolveId(guild);
    if (!id) throw new Error('UNKNOWN_GUILD');
    const d = await this.client.api.guilds(id).premium.subscriptions.put({
      data: {
        user_premium_guild_subscription_slot_ids: [this.id],
      },
    });
    this._patch({
      premium_guild_subscription: d,
    });
    return this;
  }
}
module.exports = GuildBoost;
