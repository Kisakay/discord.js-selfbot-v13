'use strict';
const { Collection } = require('@discordjs/collection');
const { ChannelTypes } = require('../util/Constants');
const Util = require('../util/Util');
class MessageMentions {
  constructor(message, users, roles, everyone, crosspostedChannels, repliedUser) {
    Object.defineProperty(this, 'client', { value: message.client });
    Object.defineProperty(this, 'guild', { value: message.guild });
    Object.defineProperty(this, '_content', { value: message.content });
    this.everyone = Boolean(everyone);
    if (users) {
      if (users instanceof Collection) {
        this.users = new Collection(users);
      } else {
        this.users = new Collection();
        for (const mention of users) {
          if (mention.member && message.guild) {
            message.guild.members._add(Object.assign(mention.member, { user: mention }));
          }
          const user = message.client.users._add(mention);
          this.users.set(user.id, user);
        }
      }
    } else {
      this.users = new Collection();
    }
    if (roles instanceof Collection) {
      this.roles = new Collection(roles);
    } else if (roles) {
      this.roles = new Collection();
      const guild = message.guild;
      if (guild) {
        for (const mention of roles) {
          const role = guild.roles.cache.get(mention);
          if (role) this.roles.set(role.id, role);
        }
      }
    } else {
      this.roles = new Collection();
    }
    this._members = null;
    this._channels = null;
    this._parsedUsers = null;
    if (crosspostedChannels) {
      if (crosspostedChannels instanceof Collection) {
        this.crosspostedChannels = new Collection(crosspostedChannels);
      } else {
        this.crosspostedChannels = new Collection();
        const channelTypes = Object.keys(ChannelTypes);
        for (const d of crosspostedChannels) {
          const type = channelTypes[d.type];
          this.crosspostedChannels.set(d.id, {
            channelId: d.id,
            guildId: d.guild_id,
            type: type ?? 'UNKNOWN',
            name: d.name,
          });
        }
      }
    } else {
      this.crosspostedChannels = new Collection();
    }
    this.repliedUser = repliedUser ? this.client.users._add(repliedUser) : null;
  }
  get members() {
    if (this._members) return this._members;
    if (!this.guild) return null;
    this._members = new Collection();
    this.users.forEach(user => {
      const member = this.guild.members.resolve(user);
      if (member) this._members.set(member.user.id, member);
    });
    return this._members;
  }
  get channels() {
    if (this._channels) return this._channels;
    this._channels = new Collection();
    let matches;
    while ((matches = this.constructor.CHANNELS_PATTERN.exec(this._content)) !== null) {
      const chan = this.client.channels.cache.get(matches[1]);
      if (chan) this._channels.set(chan.id, chan);
    }
    return this._channels;
  }
  get parsedUsers() {
    if (this._parsedUsers) return this._parsedUsers;
    this._parsedUsers = new Collection();
    let matches;
    while ((matches = this.constructor.USERS_PATTERN.exec(this._content)) !== null) {
      const user = this.client.users.cache.get(matches[1]);
      if (user) this._parsedUsers.set(user.id, user);
    }
    return this._parsedUsers;
  }
  has(data, { ignoreDirect = false, ignoreRoles = false, ignoreRepliedUser = false, ignoreEveryone = false } = {}) {
    const user = this.client.users.resolve(data);
    if (!ignoreEveryone && user && this.everyone) return true;
    const userWasRepliedTo = user && this.repliedUser?.id === user.id;
    if (!ignoreRepliedUser && userWasRepliedTo && this.users.has(user.id)) return true;
    if (!ignoreDirect) {
      if (user && (!ignoreRepliedUser || this.parsedUsers.has(user.id)) && this.users.has(user.id)) return true;
      const role = this.guild?.roles.resolve(data);
      if (role && this.roles.has(role.id)) return true;
      const channel = this.client.channels.resolve(data);
      if (channel && this.channels.has(channel.id)) return true;
    }
    if (!ignoreRoles) {
      const member = this.guild?.members.resolve(data);
      if (member) {
        for (const mentionedRole of this.roles.values()) if (member.roles.cache.has(mentionedRole.id)) return true;
      }
    }
    return false;
  }
  toJSON() {
    return Util.flatten(this, {
      members: true,
      channels: true,
    });
  }
}
MessageMentions.EVERYONE_PATTERN = /@(everyone|here)/g;
MessageMentions.USERS_PATTERN = /<@!?(\d{17,19})>/g;
MessageMentions.ROLES_PATTERN = /<@&(\d{17,19})>/g;
MessageMentions.CHANNELS_PATTERN = /<#(\d{17,19})>/g;
module.exports = MessageMentions;
