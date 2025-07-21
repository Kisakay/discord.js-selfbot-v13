'use strict';
const EventEmitter = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const { setTimeout: sleep } = require('node:timers/promises');
const { Collection } = require('@discordjs/collection');
const Shard = require('./Shard');
const { Error, TypeError, RangeError } = require('../errors');
const Util = require('../util/Util');
class ShardingManager extends EventEmitter {
  constructor(file, options = {}) {
    super();
    options = Util.mergeDefault(
      {
        totalShards: 'auto',
        mode: 'process',
        respawn: true,
        shardArgs: [],
        execArgv: [],
        token: process.env.DISCORD_TOKEN,
      },
      options,
    );
    this.file = file;
    if (!file) throw new Error('CLIENT_INVALID_OPTION', 'File', 'specified.');
    if (!path.isAbsolute(file)) this.file = path.resolve(process.cwd(), file);
    const stats = fs.statSync(this.file);
    if (!stats.isFile()) throw new Error('CLIENT_INVALID_OPTION', 'File', 'a file');
    this.shardList = options.shardList ?? 'auto';
    if (this.shardList !== 'auto') {
      if (!Array.isArray(this.shardList)) {
        throw new TypeError('CLIENT_INVALID_OPTION', 'shardList', 'an array.');
      }
      this.shardList = [...new Set(this.shardList)];
      if (this.shardList.length < 1) throw new RangeError('CLIENT_INVALID_OPTION', 'shardList', 'at least 1 id.');
      if (
        this.shardList.some(
          shardId => typeof shardId !== 'number' || isNaN(shardId) || !Number.isInteger(shardId) || shardId < 0,
        )
      ) {
        throw new TypeError('CLIENT_INVALID_OPTION', 'shardList', 'an array of positive integers.');
      }
    }
    this.totalShards = options.totalShards || 'auto';
    if (this.totalShards !== 'auto') {
      if (typeof this.totalShards !== 'number' || isNaN(this.totalShards)) {
        throw new TypeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'a number.');
      }
      if (this.totalShards < 1) throw new RangeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'at least 1.');
      if (!Number.isInteger(this.totalShards)) {
        throw new RangeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'an integer.');
      }
    }
    this.mode = options.mode;
    if (this.mode !== 'process' && this.mode !== 'worker') {
      throw new RangeError('CLIENT_INVALID_OPTION', 'Sharding mode', '"process" or "worker"');
    }
    this.respawn = options.respawn;
    this.shardArgs = options.shardArgs;
    this.execArgv = options.execArgv;
    this.token = options.token?.replace(/^Bot\s*/i, '') ?? null;
    this.shards = new Collection();
    process.env.SHARDING_MANAGER = true;
    process.env.SHARDING_MANAGER_MODE = this.mode;
    process.env.DISCORD_TOKEN = this.token;
  }
  createShard(id = this.shards.size) {
    const shard = new Shard(this, id);
    this.shards.set(id, shard);
    this.emit('shardCreate', shard);
    return shard;
  }
  async spawn({ amount = this.totalShards, delay = 5500, timeout = 30_000 } = {}) {
    if (amount === 'auto') {
      amount = 1;
    } else {
      if (typeof amount !== 'number' || isNaN(amount)) {
        throw new TypeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'a number.');
      }
      if (amount < 1) throw new RangeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'at least 1.');
      if (!Number.isInteger(amount)) {
        throw new TypeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'an integer.');
      }
    }
    if (this.shards.size >= amount) throw new Error('SHARDING_ALREADY_SPAWNED', this.shards.size);
    if (this.shardList === 'auto' || this.totalShards === 'auto' || this.totalShards !== amount) {
      this.shardList = [...Array(amount).keys()];
    }
    if (this.totalShards === 'auto' || this.totalShards !== amount) {
      this.totalShards = amount;
    }
    if (this.shardList.some(shardId => shardId >= amount)) {
      throw new RangeError(
        'CLIENT_INVALID_OPTION',
        'Amount of shards',
        'bigger than the highest shardId in the shardList option.',
      );
    }
    for (const shardId of this.shardList) {
      const promises = [];
      const shard = this.createShard(shardId);
      promises.push(shard.spawn(timeout));
      if (delay > 0 && this.shards.size !== this.shardList.length) promises.push(sleep(delay));
      await Promise.all(promises); 
    }
    return this.shards;
  }
  broadcast(message) {
    const promises = [];
    for (const shard of this.shards.values()) promises.push(shard.send(message));
    return Promise.all(promises);
  }
  async broadcastEval(script, options = {}) {
    if (typeof script !== 'function') throw new TypeError('SHARDING_INVALID_EVAL_BROADCAST');
    return this._performOnShards('eval', [`(${script})(this, ${JSON.stringify(options.context)})`], options.shard);
  }
  fetchClientValues(prop, shard) {
    return this._performOnShards('fetchClientValue', [prop], shard);
  }
  async _performOnShards(method, args, shard) {
    if (this.shards.size === 0) throw new Error('SHARDING_NO_SHARDS');
    if (typeof shard === 'number') {
      if (this.shards.has(shard)) return this.shards.get(shard)[method](...args);
      throw new Error('SHARDING_SHARD_NOT_FOUND', shard);
    }
    if (this.shards.size !== this.shardList.length) throw new Error('SHARDING_IN_PROCESS');
    const promises = [];
    for (const sh of this.shards.values()) promises.push(sh[method](...args));
    return Promise.all(promises);
  }
  async respawnAll({ shardDelay = 5_000, respawnDelay = 500, timeout = 30_000 } = {}) {
    let s = 0;
    for (const shard of this.shards.values()) {
      const promises = [shard.respawn({ delay: respawnDelay, timeout })];
      if (++s < this.shards.size && shardDelay > 0) promises.push(sleep(shardDelay));
      await Promise.all(promises); 
    }
    return this.shards;
  }
}
module.exports = ShardingManager;
