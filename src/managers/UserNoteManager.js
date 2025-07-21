'use strict';
const { Collection } = require('@discordjs/collection');
const BaseManager = require('./BaseManager');
class UserNoteManager extends BaseManager {
  constructor(client, data = {}) {
    super(client);
    this.cache = new Collection(Object.entries(data));
  }
  _reload(data = {}) {
    this.cache = new Collection(Object.entries(data));
    return this;
  }
  async updateNote(id, note = null) {
    await this.client.api.users['@me'].notes(id).put({ data: { note } });
    if (!note) this.cache.delete(id, note);
    else this.cache.set(id, note);
    return this;
  }
  async fetch(user, { cache = true, force = false } = {}) {
    const id = this.resolveId(user);
    if (!force) {
      const existing = this.cache.get(id);
      if (existing) return existing;
    }
    const data = await this.client.api.users['@me'].notes[id]
      .get()
      .then(d => d.note)
      .catch(() => '');
    if (cache) this.cache.set(id, data);
    return data;
  }
}
module.exports = UserNoteManager;
