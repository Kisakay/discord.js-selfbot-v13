'use strict';
const { setInterval } = require('node:timers');
const { Collection } = require('@discordjs/collection');
const Invite = require('./Invite');
const User = require('./User');
const DataResolver = require('../util/DataResolver');
const PremiumUsageFlags = require('../util/PremiumUsageFlags');
const PurchasedFlags = require('../util/PurchasedFlags');
const Util = require('../util/Util');
class ClientUser extends User {
  #packageName = null;
  #intervalSamsungPresence = setInterval(
    () => {
      this.client.emit('debug', `[UPDATE] Samsung Presence: ${this.#packageName}`);
      if (!this.#packageName) return;
      this.setSamsungActivity(this.#packageName, 'UPDATE');
    },
    1000 * 60 * 10,
  ).unref();
  _patch(data) {
    super._patch(data);
    if ('verified' in data) {
      this.verified = data.verified;
    }
    if ('mfa_enabled' in data) {
      this.mfaEnabled = typeof data.mfa_enabled === 'boolean' ? data.mfa_enabled : null;
    } else {
      this.mfaEnabled ??= null;
    }
    if ('token' in data) this.client.token = data.token;
    if ('purchased_flags' in data) {
      this.purchasedFlags = new PurchasedFlags(data.purchased_flags || 0).freeze();
    } else {
      this.purchasedFlags = new PurchasedFlags().freeze();
    }
    if ('premium_usage_flags' in data) {
      this.premiumUsageFlags = new PremiumUsageFlags(data.premium_usage_flags || 0);
    } else {
      this.premiumUsageFlags = new PremiumUsageFlags().freeze();
    }
    if ('phone' in data) {
      this.phone = data.phone;
    }
    if ('nsfw_allowed' in data) {
      this.nsfwAllowed = data.nsfw_allowed;
    }
    if ('email' in data) {
      this.email = data.email;
    }
    if ('bio' in data) {
      this.bio = data.bio;
    }
    if ('pronouns' in data) {
      this.pronouns = data.pronouns;
    }
    if ('premium_type' in data) {
      this.premiumType = data.premium_type;
    }
  }
  get presence() {
    return this.client.presence;
  }
  async edit(options = {}) {
    const data = await this.client.api.users('@me').patch({ data: options });
    this.client.token = data.token;
    const { updated } = this.client.actions.UserUpdate.handle(data);
    return updated ?? this;
  }
  setUsername(username, password) {
    return this.edit({ username, password });
  }
  async setAvatar(avatar) {
    avatar = avatar && (await DataResolver.resolveImage(avatar));
    return this.edit({ avatar });
  }
  setPresence(data) {
    return this.client.presence.set(data);
  }
  setStatus(status, shardId) {
    return this.setPresence({ status, shardId });
  }
  setActivity(name, options = {}) {
    if (!name) return this.setPresence({ activities: [], shardId: options.shardId });
    const activity = Object.assign({}, options, typeof name === 'object' ? name : { name });
    return this.setPresence({ activities: [activity], shardId: activity.shardId });
  }
  setAFK(afk = true, shardId) {
    return this.setPresence({ afk, shardId });
  }
  async setBanner(banner) {
    banner = banner && (await DataResolver.resolveImage(banner));
    return this.edit({ banner });
  }
  setHypeSquad(type) {
    switch (type) {
      case 'LEAVE': {
        type = 0;
        break;
      }
      case 'HOUSE_BRAVERY': {
        type = 1;
        break;
      }
      case 'HOUSE_BRILLIANCE': {
        type = 2;
        break;
      }
      case 'HOUSE_BALANCE': {
        type = 3;
        break;
      }
    }
    if (type == 0) {
      return this.client.api.hypesquad.online.delete();
    } else {
      return this.client.api.hypesquad.online.post({
        data: { house_id: type },
      });
    }
  }
  setAccentColor(color = null) {
    return this.edit({ accent_color: color ? Util.resolveColor(color) : null });
  }
  setAboutMe(bio = null) {
    return this.edit({ bio });
  }
  async createFriendInvite() {
    const data = await this.client.api.users['@me'].invites.post({
      data: {},
    });
    return new Invite(this.client, data);
  }
  async getAllFriendInvites() {
    const data = await this.client.api.users['@me'].invites.get();
    const collection = new Collection();
    for (const invite of data) {
      collection.set(invite.code, new Invite(this.client, invite));
    }
    return collection;
  }
  revokeAllFriendInvites() {
    return this.client.api.users['@me'].invites.delete();
  }
  async setSamsungActivity(packageName, type = 'START') {
    type = type.toUpperCase();
    if (!packageName || typeof packageName !== 'string') throw new Error('Package name is required.');
    if (!['START', 'UPDATE', 'STOP'].includes(type)) throw new Error('Invalid type (Must be START, UPDATE, or STOP)');
    await this.client.api.presences.post({
      data: {
        package_name: packageName,
        update: type,
      },
    });
    if (type !== 'STOP') this.#packageName = packageName;
    else this.#packageName = null;
    return this;
  }
  stopRinging(channel) {
    return this.client.api.channels(this.client.channels.resolveId(channel)).call['stop-ringing'].post({
      data: {},
    });
  }
  fetchBurstCredit() {
    return this.client.api.users['@me']['burst-credits'].get().then(d => d.amount);
  }
  setGlobalName(globalName = '') {
    return this.edit({ global_name: globalName });
  }
  setPronouns(pronouns = '') {
    return this.edit({ pronouns });
  }
}
module.exports = ClientUser;
