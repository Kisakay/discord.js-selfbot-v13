'use strict';
const { Collection } = require('@discordjs/collection');
const BaseManager = require('./BaseManager');
const GuildBoost = require('../structures/GuildBoost');
class BillingManager extends BaseManager {
  constructor(client) {
    super(client);
    this.paymentSources = new Collection();
    this.guildBoosts = new Collection();
    this.currentSubscription = new Collection();
  }
  async fetchPaymentSources() {
    const d = await this.client.api.users('@me').billing['payment-sources'].get();
    this.paymentSources = new Collection(d.map(s => [s.id, s]));
    return this.paymentSources;
  }
  async fetchGuildBoosts() {
    const d = await this.client.api.users('@me').guilds.premium['subscription-slots'].get();
    this.guildBoosts = new Collection(d.map(s => [s.id, new GuildBoost(this.client, s)]));
    return this.guildBoosts;
  }
  async fetchCurrentSubscription() {
    const d = await this.client.api.users('@me').billing.subscriptions.get();
    this.currentSubscription = new Collection(d.map(s => [s.id, s]));
    return this.currentSubscription;
  }
}
module.exports = BillingManager;
