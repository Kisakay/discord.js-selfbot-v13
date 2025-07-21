'use strict';
const Base = require('./Base');
const IntegrationApplication = require('./IntegrationApplication');
const { Error } = require('../errors');
const { Endpoints } = require('../util/Constants');
const InviteFlags = require('../util/InviteFlags');
const Permissions = require('../util/Permissions');
class Invite extends Base {
  constructor(client, data) {
    super(client);
    this._patch(data);
  }
  _patch(data) {
    const InviteGuild = require('./InviteGuild');
    this.guild ??= null;
    if (data.guild) {
      this.guild = this.client.guilds.cache.get(data.guild.id) ?? new InviteGuild(this.client, data.guild);
    }
    if ('code' in data) {
      this.code = data.code;
    }
    if ('approximate_presence_count' in data) {
      this.presenceCount = data.approximate_presence_count;
    } else {
      this.presenceCount ??= null;
    }
    if ('approximate_member_count' in data) {
      this.memberCount = data.approximate_member_count;
    } else {
      this.memberCount ??= null;
    }
    if ('temporary' in data) {
      this.temporary = data.temporary ?? null;
    } else {
      this.temporary ??= null;
    }
    if ('max_age' in data) {
      this.maxAge = data.max_age;
    } else {
      this.maxAge ??= null;
    }
    if ('uses' in data) {
      this.uses = data.uses;
    } else {
      this.uses ??= null;
    }
    if ('max_uses' in data) {
      this.maxUses = data.max_uses;
    } else {
      this.maxUses ??= null;
    }
    if ('inviter_id' in data) {
      this.inviterId = data.inviter_id;
      this.inviter = this.client.users.resolve(data.inviter_id);
    } else {
      this.inviterId ??= null;
    }
    if ('inviter' in data) {
      this.inviter ??= this.client.users._add(data.inviter);
      this.inviterId = data.inviter.id;
    } else {
      this.inviter ??= null;
    }
    if ('target_user' in data) {
      this.targetUser = this.client.users._add(data.target_user);
    } else {
      this.targetUser ??= null;
    }
    if ('target_application' in data) {
      this.targetApplication = new IntegrationApplication(this.client, data.target_application);
    } else {
      this.targetApplication ??= null;
    }
    if ('target_type' in data) {
      this.targetType = data.target_type;
    } else {
      this.targetType ??= null;
    }
    if ('type' in data) {
      this.type = data.type;
    } else {
      this.type ??= null;
    }
    if ('channel_id' in data) {
      this.channelId = data.channel_id;
      this.channel = this.client.channels.cache.get(data.channel_id);
    }
    if ('channel' in data && data.channel !== null) {
      this.channel ??= this.client.channels._add(data.channel, this.guild, { cache: false });
      this.channelId ??= data.channel.id;
    }
    if ('created_at' in data) {
      this.createdTimestamp = new Date(data.created_at).getTime();
    } else {
      this.createdTimestamp ??= null;
    }
    if ('expires_at' in data) {
      this._expiresTimestamp = data.expires_at && Date.parse(data.expires_at);
    } else {
      this._expiresTimestamp ??= null;
    }
    this.stageInstance ??= null;
    this.guildScheduledEvent ??= null;
    if ('flags' in data) {
      this.flags = new InviteFlags(data.flags).freeze();
    } else {
      this.flags ??= new InviteFlags().freeze();
    }
  }
  get createdAt() {
    return this.createdTimestamp ? new Date(this.createdTimestamp) : null;
  }
  get deletable() {
    const guild = this.guild;
    if (!guild || !this.client.guilds.cache.has(guild.id)) return false;
    if (!guild.members.me) throw new Error('GUILD_UNCACHED_ME');
    return (
      this.channel.permissionsFor(this.client.user).has(Permissions.FLAGS.MANAGE_CHANNELS, false) ||
      guild.members.me.permissions.has(Permissions.FLAGS.MANAGE_GUILD)
    );
  }
  get expiresTimestamp() {
    return (
      this._expiresTimestamp ??
      (this.createdTimestamp && this.maxAge ? this.createdTimestamp + this.maxAge * 1_000 : null)
    );
  }
  get expiresAt() {
    const { expiresTimestamp } = this;
    return expiresTimestamp ? new Date(expiresTimestamp) : null;
  }
  get url() {
    return Endpoints.invite(this.client.options.http.invite, this.code);
  }
  async delete(reason) {
    await this.client.api.invites[this.code].delete({ reason });
    return this;
  }
  toString() {
    return this.url;
  }
  toJSON() {
    return super.toJSON({
      url: true,
      expiresTimestamp: true,
      presenceCount: false,
      memberCount: false,
      uses: false,
      channel: 'channelId',
      inviter: 'inviterId',
      guild: 'guildId',
    });
  }
  valueOf() {
    return this.code;
  }
}
Invite.INVITES_PATTERN = /discord(?:(?:app)?\.com\/invite|\.gg(?:\/invite)?)\/([\w-]{2,255})/gi;
module.exports = Invite;
