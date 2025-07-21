'use strict';
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { Error } = require('../errors');
const User = require('../structures/User');
const { ReactionTypes } = require('../util/Constants');
class ReactionUserManager extends CachedManager {
  constructor(reaction, iterable) {
    super(reaction.client, User, iterable);
    this.reaction = reaction;
  }
  async fetch({ limit = 100, after, type = 'NORMAL' } = {}) {
    const message = this.reaction.message;
    const data = await this.client.api.channels[message.channelId].messages[message.id].reactions[
      this.reaction.emoji.identifier
    ].get({ query: { limit, after, type: typeof type == 'number' ? type : ReactionTypes[type] } });
    const users = new Collection();
    for (const rawUser of data) {
      const user = this.client.users._add(rawUser);
      this.cache.set(user.id, user);
      users.set(user.id, user);
    }
    return users;
  }
  async remove(user = this.client.user) {
    const userId = this.client.users.resolveId(user);
    if (!userId) throw new Error('REACTION_RESOLVE_USER');
    const message = this.reaction.message;
    await this.client.api.channels[message.channelId].messages[message.id].reactions[this.reaction.emoji.identifier][
      userId === this.client.user.id ? '@me' : userId
    ].delete();
    return this.reaction;
  }
}
module.exports = ReactionUserManager;
