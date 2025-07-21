'use strict';
const { Collection } = require('@discordjs/collection');
const BaseManager = require('./BaseManager');
const { GuildMember } = require('../structures/GuildMember');
const { Message } = require('../structures/Message');
const ThreadMember = require('../structures/ThreadMember');
const User = require('../structures/User');
const { RelationshipTypes } = require('../util/Constants');
class RelationshipManager extends BaseManager {
  constructor(client, users) {
    super(client);
    this.cache = new Collection();
    this.friendNicknames = new Collection();
    this.sinceCache = new Collection();
    this._setup(users);
  }
  get friendCache() {
    const users = this.cache
      .filter(value => value === RelationshipTypes.FRIEND)
      .map((_, key) => [key, this.client.users.cache.get(key)]);
    return new Collection(users);
  }
  get blockedCache() {
    const users = this.cache
      .filter(value => value === RelationshipTypes.BLOCKED)
      .map((_, key) => [key, this.client.users.cache.get(key)]);
    return new Collection(users);
  }
  get incomingCache() {
    const users = this.cache
      .filter(value => value === RelationshipTypes.PENDING_INCOMING)
      .map((_, key) => [key, this.client.users.cache.get(key)]);
    return new Collection(users);
  }
  get outgoingCache() {
    const users = this.cache
      .filter(value => value === RelationshipTypes.PENDING_OUTGOING)
      .map((_, key) => [key, this.client.users.cache.get(key)]);
    return new Collection(users);
  }
  toJSON() {
    return this.cache.map((value, key) => ({
      id: key,
      type: RelationshipTypes[value],
      nickname: this.friendNicknames.get(key),
      since: this.sinceCache.get(key).toISOString(),
    }));
  }
  _setup(users) {
    if (!Array.isArray(users)) return;
    for (const relationShip of users) {
      this.friendNicknames.set(relationShip.id, relationShip.nickname);
      this.cache.set(relationShip.id, relationShip.type);
      this.sinceCache.set(relationShip.id, new Date(relationShip.since || 0));
    }
  }
  resolveId(user) {
    if (user instanceof ThreadMember) return user.id;
    if (user instanceof GuildMember) return user.user.id;
    if (user instanceof Message) return user.author.id;
    if (user instanceof User) return user.id;
    return user.match(/\d{17,19}/)?.[0] || null;
  }
  resolveUsername(user) {
    if (user instanceof ThreadMember) return user.member.user.username;
    if (user instanceof GuildMember) return user.user.username;
    if (user instanceof Message) return user.author.username;
    if (user instanceof User) return user.username;
    return user;
  }
  async fetch(user, { force = false } = {}) {
    if (user) {
      const id = this.resolveId(user);
      if (!force) {
        const existing = this.cache.get(id);
        if (existing && !existing.partial) return existing;
      }
      const data = await this.client.api.users['@me'].relationships.get();
      await this._setup(data);
      return this.cache.get(id);
    } else {
      const data = await this.client.api.users['@me'].relationships.get();
      await this._setup(data);
      return this;
    }
  }
  async deleteRelationship(user) {
    throw new Error('Risky action, not finished yet.');
    const id = this.resolveId(user);
    if (
      ![RelationshipTypes.FRIEND, RelationshipTypes.BLOCKED, RelationshipTypes.PENDING_OUTGOING].includes(
        this.cache.get(id),
      )
    ) {
      return Promise.resolve(false);
    }
    await this.client.api.users['@me'].relationships[id].delete({
      DiscordContext: { location: 'ContextMenu' },
    });
    return true;
  }
  async sendFriendRequest(options) {
    throw new Error('Risky action, not finished yet.');
    const id = this.resolveId(options);
    if (id) {
      await this.client.api.users['@me'].relationships[id].put({
        data: {},
        DiscordContext: { location: 'ContextMenu' },
      });
    } else {
      const username = this.resolveUsername(options);
      await this.client.api.users['@me'].relationships.post({
        versioned: true,
        data: {
          username,
          discriminator: null,
        },
        DiscordContext: { location: 'Add Friend' },
      });
    }
    return true;
  }
  async addFriend(user) {
    throw new Error('Risky action, not finished yet.');
    const id = this.resolveId(user);
    if (this.cache.get(id) === RelationshipTypes.FRIEND) return Promise.resolve(false);
    if (this.cache.get(id) === RelationshipTypes.PENDING_OUTGOING) return Promise.resolve(false);
    await this.client.api.users['@me'].relationships[id].put({
      data: { confirm_stranger_request: true },
      DiscordContext: { location: 'Friends' },
    });
    return true;
  }
  async setNickname(user, nickname = null) {
    const id = this.resolveId(user);
    if (this.cache.get(id) !== RelationshipTypes.FRIEND) return Promise.resolve(false);
    await this.client.api.users['@me'].relationships[id].patch({
      data: {
        nickname: typeof nickname === 'string' ? nickname : null,
      },
    });
    if (nickname) {
      this.friendNicknames.set(id, nickname);
    } else {
      this.friendNicknames.delete(id);
    }
    return true;
  }
  async addBlocked(user) {
    throw new Error('Risky action, not finished yet.');
    const id = this.resolveId(user);
    if (this.cache.get(id) === RelationshipTypes.BLOCKED) return Promise.resolve(false);
    await this.client.api.users['@me'].relationships[id].put({
      data: {
        type: RelationshipTypes.BLOCKED,
      },
      DiscordContext: { location: 'ContextMenu' },
    });
    return true;
  }
}
module.exports = RelationshipManager;
