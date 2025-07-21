'use strict';
const process = require('node:process');
const Base = require('./Base');
const { Error } = require('../errors');
const Permissions = require('../util/Permissions');
const RoleFlags = require('../util/RoleFlags');
const SnowflakeUtil = require('../util/SnowflakeUtil');
let deprecationEmittedForComparePositions = false;
const deletedRoles = new WeakSet();
let deprecationEmittedForDeleted = false;
class Role extends Base {
  constructor(client, data, guild) {
    super(client);
    this.guild = guild;
    this.icon = null;
    this.unicodeEmoji = null;
    if (data) this._patch(data);
  }
  _patch(data) {
    this.id = data.id;
    if ('name' in data) {
      this.name = data.name;
    }
    if ('color' in data) {
      this.color = data.color;
    }
    if ('hoist' in data) {
      this.hoist = data.hoist;
    }
    if ('position' in data) {
      this.rawPosition = data.position;
    }
    if ('permissions' in data) {
      this.permissions = new Permissions(BigInt(data.permissions)).freeze();
    }
    if ('managed' in data) {
      this.managed = data.managed;
    }
    if ('mentionable' in data) {
      this.mentionable = data.mentionable;
    }
    if ('icon' in data) this.icon = data.icon;
    if ('unicode_emoji' in data) this.unicodeEmoji = data.unicode_emoji;
    this.tags = data.tags ? {} : null;
    if (data.tags) {
      if ('bot_id' in data.tags) {
        this.tags.botId = data.tags.bot_id;
      }
      if ('integration_id' in data.tags) {
        this.tags.integrationId = data.tags.integration_id;
      }
      if ('premium_subscriber' in data.tags) {
        this.tags.premiumSubscriberRole = true;
      }
      if ('subscription_listing_id' in data.tags) {
        this.tags.subscriptionListingId = data.tags.subscription_listing_id;
      }
      if ('available_for_purchase' in data.tags) {
        this.tags.availableForPurchase = true;
      }
      if ('guild_connections' in data.tags) {
        this.tags.guildConnections = true;
      }
    }
    if ('flags' in data) {
      this.flags = new RoleFlags(data.flags).freeze();
    } else {
      this.flags ??= new RoleFlags().freeze();
    }
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  get deleted() {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Role#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedRoles.has(this);
  }
  set deleted(value) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Role#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedRoles.add(this);
    else deletedRoles.delete(this);
  }
  get hexColor() {
    return `#${this.color.toString(16).padStart(6, '0')}`;
  }
  get members() {
    return this.guild.members.cache.filter(m => m.roles.cache.has(this.id));
  }
  get editable() {
    if (this.managed) return false;
    const clientMember = this.guild.members.resolve(this.client.user);
    if (!clientMember.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) return false;
    return clientMember.roles.highest.comparePositionTo(this) > 0;
  }
  get position() {
    let count = 0;
    for (const role of this.guild.roles.cache.values()) {
      if (this.rawPosition > role.rawPosition) count++;
      else if (this.rawPosition === role.rawPosition && BigInt(this.id) < BigInt(role.id)) count++;
    }
    return count;
  }
  comparePositionTo(role) {
    return this.guild.roles.comparePositions(this, role);
  }
  edit(data, reason) {
    return this.guild.roles.edit(this, data, reason);
  }
  permissionsIn(channel, checkAdmin = true) {
    channel = this.guild.channels.resolve(channel);
    if (!channel) throw new Error('GUILD_CHANNEL_RESOLVE');
    return channel.rolePermissions(this, checkAdmin);
  }
  setName(name, reason) {
    return this.edit({ name }, reason);
  }
  setColor(color, reason) {
    return this.edit({ color }, reason);
  }
  setHoist(hoist = true, reason) {
    return this.edit({ hoist }, reason);
  }
  setPermissions(permissions, reason) {
    return this.edit({ permissions }, reason);
  }
  setMentionable(mentionable = true, reason) {
    return this.edit({ mentionable }, reason);
  }
  setIcon(icon, reason) {
    return this.edit({ icon }, reason);
  }
  setUnicodeEmoji(unicodeEmoji, reason) {
    return this.edit({ unicodeEmoji }, reason);
  }
  setPosition(position, options = {}) {
    return this.guild.roles.setPosition(this, position, options);
  }
  async delete(reason) {
    await this.guild.roles.delete(this.id, reason);
    return this;
  }
  fetchMemberIds() {
    return this.guild.roles.fetchMemberIds(this.id);
  }
  iconURL({ format, size } = {}) {
    if (!this.icon) return null;
    return this.client.rest.cdn.RoleIcon(this.id, this.icon, format, size);
  }
  equals(role) {
    return (
      role &&
      this.id === role.id &&
      this.name === role.name &&
      this.color === role.color &&
      this.hoist === role.hoist &&
      this.position === role.position &&
      this.permissions.bitfield === role.permissions.bitfield &&
      this.managed === role.managed &&
      this.icon === role.icon &&
      this.unicodeEmoji === role.unicodeEmoji
    );
  }
  toString() {
    if (this.id === this.guild.id) return '@everyone';
    return `<@&${this.id}>`;
  }
  toJSON() {
    return {
      ...super.toJSON({ createdTimestamp: true }),
      permissions: this.permissions.toJSON(),
    };
  }
  static comparePositions(role1, role2) {
    if (!deprecationEmittedForComparePositions) {
      process.emitWarning(
        'The Role.comparePositions method is deprecated. Use RoleManager#comparePositions instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForComparePositions = true;
    }
    return role1.guild.roles.comparePositions(role1, role2);
  }
}
exports.Role = Role;
exports.deletedRoles = deletedRoles;
