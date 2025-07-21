'use strict';
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const ThreadChannel = require('../structures/ThreadChannel');
class ThreadManager extends CachedManager {
  constructor(channel, iterable) {
    super(channel.client, ThreadChannel, iterable);
    this.channel = channel;
  }
  _add(thread) {
    const existing = this.cache.get(thread.id);
    if (existing) return existing;
    this.cache.set(thread.id, thread);
    return thread;
  }
  fetch(options, { cache, force } = {}) {
    if (!options) return this.fetchActive(cache);
    const channel = this.client.channels.resolveId(options);
    if (channel) return this.client.channels.fetch(channel, { cache, force });
    if (options.archived) {
      return this.fetchArchived(options.archived, cache);
    }
    return this.fetchActive(cache);
  }
  fetchArchived(options = {}, cache = true) {
    return this.fetchActive(cache, { archived: true, ...options });
  }
  async fetchActive(cache = true, options = {}) {
    const raw = await this.client.api.channels(this.channel.id).threads.search.get({
      query: {
        archived: options?.archived ?? false,
        limit: options?.limit ?? 25,
        offset: options?.offset ?? 0,
        sort_by: options?.sortBy ?? 'last_message_time',
        sort_order: options?.sortOrder ?? 'desc',
      },
    });
    return this.constructor._mapThreads(raw, this.client, { parent: this.channel, cache });
  }
  static _mapThreads(rawThreads, client, { parent, guild, cache }) {
    const threads = rawThreads.threads.reduce((coll, raw) => {
      const thread = client.channels._add(raw, guild ?? parent?.guild, { cache });
      if (parent && thread.parentId !== parent.id) return coll;
      return coll.set(thread.id, thread);
    }, new Collection());
    for (const rawMember of rawThreads.members) client.channels.cache.get(rawMember.id)?.members._add(rawMember);
    for (const rawMessage of rawThreads?.first_messages || []) {
      client.channels.cache.get(rawMessage.id)?.messages._add(rawMessage);
    }
    return {
      threads,
      hasMore: rawThreads.has_more ?? false,
    };
  }
}
module.exports = ThreadManager;
