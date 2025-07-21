'use strict';
const CachedManager = require('./CachedManager');
const { Presence } = require('../structures/Presence');
class PresenceManager extends CachedManager {
  constructor(client, iterable) {
    super(client, Presence, iterable);
  }
  _add(data, cache) {
    return super._add(data, cache, { id: data.user.id });
  }
  resolve(presence) {
    const presenceResolvable = super.resolve(presence);
    if (presenceResolvable) return presenceResolvable;
    const userId = this.client.users.resolveId(presence);
    return this.cache.get(userId) ?? null;
  }
  resolveId(presence) {
    const presenceResolvable = super.resolveId(presence);
    if (presenceResolvable) return presenceResolvable;
    const userId = this.client.users.resolveId(presence);
    return this.cache.has(userId) ? userId : null;
  }
  async fetch() {
    const data = await this.client.api.presences.get();
    data.presences.forEach(presence => {
      this._add(presence, true);
    });
    return this.cache;
  }
}
module.exports = PresenceManager;
