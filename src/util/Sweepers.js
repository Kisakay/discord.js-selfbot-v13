'use strict';
const { setInterval } = require('node:timers');
const { Events, ThreadChannelTypes, SweeperKeys } = require('./Constants');
const { TypeError } = require('../errors/DJSError.js');
class Sweepers {
  constructor(client, options) {
    Object.defineProperty(this, 'client', { value: client });
    this.options = options;
    this.intervals = Object.fromEntries(SweeperKeys.map(key => [key, null]));
    for (const key of SweeperKeys) {
      if (!(key in options)) continue;
      this._validateProperties(key);
      const clonedOptions = { ...this.options[key] };
      if (!('filter' in clonedOptions)) {
        switch (key) {
          case 'invites':
            clonedOptions.filter = this.constructor.expiredInviteSweepFilter(clonedOptions.lifetime);
            break;
          case 'messages':
            clonedOptions.filter = this.constructor.outdatedMessageSweepFilter(clonedOptions.lifetime);
            break;
          case 'threads':
            clonedOptions.filter = this.constructor.archivedThreadSweepFilter(clonedOptions.lifetime);
        }
      }
      this._initInterval(key, `sweep${key[0].toUpperCase()}${key.slice(1)}`, clonedOptions);
    }
  }
  sweepApplicationCommands(filter) {
    const { guilds, items: guildCommands } = this._sweepGuildDirectProp('commands', filter, { emit: false });
    const globalCommands = this.client.application?.commands.cache.sweep(filter) ?? 0;
    this.client.emit(
      Events.CACHE_SWEEP,
      `Swept ${globalCommands} global application commands and ${guildCommands} guild commands in ${guilds} guilds.`,
    );
    return guildCommands + globalCommands;
  }
  sweepAutoModerationRules(filter) {
    return this._sweepGuildDirectProp('autoModerationRules', filter).items;
  }
  sweepBans(filter) {
    return this._sweepGuildDirectProp('bans', filter).items;
  }
  sweepEmojis(filter) {
    return this._sweepGuildDirectProp('emojis', filter).items;
  }
  sweepInvites(filter) {
    return this._sweepGuildDirectProp('invites', filter).items;
  }
  sweepGuildMembers(filter) {
    return this._sweepGuildDirectProp('members', filter, { outputName: 'guild members' }).items;
  }
  sweepMessages(filter) {
    if (typeof filter !== 'function') {
      throw new TypeError('INVALID_TYPE', 'filter', 'function');
    }
    let channels = 0;
    let messages = 0;
    for (const channel of this.client.channels.cache.values()) {
      if (!channel.isText()) continue;
      channels++;
      messages += channel.messages.cache.sweep(filter);
    }
    this.client.emit(Events.CACHE_SWEEP, `Swept ${messages} messages in ${channels} text-based channels.`);
    return messages;
  }
  sweepPresences(filter) {
    return this._sweepGuildDirectProp('presences', filter).items;
  }
  sweepReactions(filter) {
    if (typeof filter !== 'function') {
      throw new TypeError('INVALID_TYPE', 'filter', 'function');
    }
    let channels = 0;
    let messages = 0;
    let reactions = 0;
    for (const channel of this.client.channels.cache.values()) {
      if (!channel.isText()) continue;
      channels++;
      for (const message of channel.messages.cache.values()) {
        messages++;
        reactions += message.reactions.cache.sweep(filter);
      }
    }
    this.client.emit(
      Events.CACHE_SWEEP,
      `Swept ${reactions} reactions on ${messages} messages in ${channels} text-based channels.`,
    );
    return reactions;
  }
  sweepStageInstances(filter) {
    return this._sweepGuildDirectProp('stageInstances', filter, { outputName: 'stage instances' }).items;
  }
  sweepStickers(filter) {
    return this._sweepGuildDirectProp('stickers', filter).items;
  }
  sweepThreadMembers(filter) {
    if (typeof filter !== 'function') {
      throw new TypeError('INVALID_TYPE', 'filter', 'function');
    }
    let threads = 0;
    let members = 0;
    for (const channel of this.client.channels.cache.values()) {
      if (!ThreadChannelTypes.includes(channel.type)) continue;
      threads++;
      members += channel.members.cache.sweep(filter);
    }
    this.client.emit(Events.CACHE_SWEEP, `Swept ${members} thread members in ${threads} threads.`);
    return members;
  }
  sweepThreads(filter) {
    if (typeof filter !== 'function') {
      throw new TypeError('INVALID_TYPE', 'filter', 'function');
    }
    let threads = 0;
    for (const [key, val] of this.client.channels.cache.entries()) {
      if (!ThreadChannelTypes.includes(val.type)) continue;
      if (filter(val, key, this.client.channels.cache)) {
        threads++;
        this.client.channels._remove(key);
      }
    }
    this.client.emit(Events.CACHE_SWEEP, `Swept ${threads} threads.`);
    return threads;
  }
  sweepUsers(filter) {
    if (typeof filter !== 'function') {
      throw new TypeError('INVALID_TYPE', 'filter', 'function');
    }
    const users = this.client.users.cache.sweep(filter);
    this.client.emit(Events.CACHE_SWEEP, `Swept ${users} users.`);
    return users;
  }
  destroy() {
    for (const key of SweeperKeys) {
      if (this.intervals[key]) clearInterval(this.intervals[key]);
    }
  }
  static filterByLifetime({
    lifetime = 14400,
    getComparisonTimestamp = e => e?.createdTimestamp,
    excludeFromSweep = () => false,
  } = {}) {
    if (typeof lifetime !== 'number') {
      throw new TypeError('INVALID_TYPE', 'lifetime', 'number');
    }
    if (typeof getComparisonTimestamp !== 'function') {
      throw new TypeError('INVALID_TYPE', 'getComparisonTimestamp', 'function');
    }
    if (typeof excludeFromSweep !== 'function') {
      throw new TypeError('INVALID_TYPE', 'excludeFromSweep', 'function');
    }
    return () => {
      if (lifetime <= 0) return null;
      const lifetimeMs = lifetime * 1_000;
      const now = Date.now();
      return (entry, key, coll) => {
        if (excludeFromSweep(entry, key, coll)) {
          return false;
        }
        const comparisonTimestamp = getComparisonTimestamp(entry, key, coll);
        if (!comparisonTimestamp || typeof comparisonTimestamp !== 'number') return false;
        return now - comparisonTimestamp > lifetimeMs;
      };
    };
  }
  static archivedThreadSweepFilter(lifetime = 14400) {
    return this.filterByLifetime({
      lifetime,
      getComparisonTimestamp: e => e.archiveTimestamp,
      excludeFromSweep: e => !e.archived,
    });
  }
  static expiredInviteSweepFilter(lifetime = 14400) {
    return this.filterByLifetime({
      lifetime,
      getComparisonTimestamp: i => i.expiresTimestamp,
    });
  }
  static outdatedMessageSweepFilter(lifetime = 3600) {
    return this.filterByLifetime({
      lifetime,
      getComparisonTimestamp: m => m.editedTimestamp ?? m.createdTimestamp,
    });
  }
  _sweepGuildDirectProp(key, filter, { emit = true, outputName } = {}) {
    if (typeof filter !== 'function') {
      throw new TypeError('INVALID_TYPE', 'filter', 'function');
    }
    let guilds = 0;
    let items = 0;
    for (const guild of this.client.guilds.cache.values()) {
      const { cache } = guild[key];
      guilds++;
      items += cache.sweep(filter);
    }
    if (emit) {
      this.client.emit(Events.CACHE_SWEEP, `Swept ${items} ${outputName ?? key} in ${guilds} guilds.`);
    }
    return { guilds, items };
  }
  _validateProperties(key) {
    const props = this.options[key];
    if (typeof props !== 'object') {
      throw new TypeError('INVALID_TYPE', `sweepers.${key}`, 'object', true);
    }
    if (typeof props.interval !== 'number') {
      throw new TypeError('INVALID_TYPE', `sweepers.${key}.interval`, 'number');
    }
    if (['invites', 'messages', 'threads'].includes(key) && !('filter' in props)) {
      if (typeof props.lifetime !== 'number') {
        throw new TypeError('INVALID_TYPE', `sweepers.${key}.lifetime`, 'number');
      }
      return;
    }
    if (typeof props.filter !== 'function') {
      throw new TypeError('INVALID_TYPE', `sweepers.${key}.filter`, 'function');
    }
  }
  _initInterval(intervalKey, sweepKey, opts) {
    if (opts.interval <= 0 || opts.interval === Infinity) return;
    this.intervals[intervalKey] = setInterval(() => {
      const sweepFn = opts.filter();
      if (sweepFn === null) return;
      if (typeof sweepFn !== 'function') throw new TypeError('SWEEP_FILTER_RETURN');
      this[sweepKey](sweepFn);
    }, opts.interval * 1_000).unref();
  }
}
module.exports = Sweepers;
