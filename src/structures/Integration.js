'use strict';
const Base = require('./Base');
const IntegrationApplication = require('./IntegrationApplication');
class Integration extends Base {
  constructor(client, data, guild) {
    super(client);
    this.guild = guild;
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.enabled = data.enabled;
    this.syncing = data.syncing;
    this.role = this.guild.roles.cache.get(data.role_id);
    if ('enable_emoticons' in data) {
      this.enableEmoticons = data.enable_emoticons;
    } else {
      this.enableEmoticons ??= null;
    }
    if (data.user) {
      this.user = this.client.users._add(data.user);
    } else {
      this.user = null;
    }
    this.account = data.account;
    this.syncedAt = data.synced_at;
    if ('subscriber_count' in data) {
      this.subscriberCount = data.subscriber_count;
    } else {
      this.subscriberCount ??= null;
    }
    if ('revoked' in data) {
      this.revoked = data.revoked;
    } else {
      this.revoked ??= null;
    }
    this._patch(data);
  }
  get roles() {
    const roles = this.guild.roles.cache;
    return roles.filter(role => role.tags?.integrationId === this.id);
  }
  _patch(data) {
    if ('expire_behavior' in data) {
      this.expireBehavior = data.expire_behavior;
    }
    if ('expire_grace_period' in data) {
      this.expireGracePeriod = data.expire_grace_period;
    }
    if ('application' in data) {
      if (this.application) {
        this.application._patch(data.application);
      } else {
        this.application = new IntegrationApplication(this.client, data.application);
      }
    } else {
      this.application ??= null;
    }
  }
  async delete(reason) {
    await this.client.api.guilds(this.guild.id).integrations(this.id).delete({ reason });
    return this;
  }
  toJSON() {
    return super.toJSON({
      role: 'roleId',
      guild: 'guildId',
      user: 'userId',
    });
  }
}
module.exports = Integration;
