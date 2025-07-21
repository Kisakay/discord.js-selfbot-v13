'use strict';
const process = require('node:process');
const { Error } = require('../errors');
const { Events } = require('../util/Constants');
const Util = require('../util/Util');
class ShardClientUtil {
  constructor(client, mode) {
    this.client = client;
    this.mode = mode;
    this.parentPort = null;
    if (mode === 'process') {
      process.on('message', this._handleMessage.bind(this));
      client.on('ready', () => {
        process.send({ _ready: true });
      });
      client.on('disconnect', () => {
        process.send({ _disconnect: true });
      });
      client.on('reconnecting', () => {
        process.send({ _reconnecting: true });
      });
    } else if (mode === 'worker') {
      this.parentPort = require('node:worker_threads').parentPort;
      this.parentPort.on('message', this._handleMessage.bind(this));
      client.on('ready', () => {
        this.parentPort.postMessage({ _ready: true });
      });
      client.on('disconnect', () => {
        this.parentPort.postMessage({ _disconnect: true });
      });
      client.on('reconnecting', () => {
        this.parentPort.postMessage({ _reconnecting: true });
      });
    }
  }
  get ids() {
    return this.client.options.shards;
  }
  get count() {
    return this.client.options.shardCount;
  }
  send(message) {
    return new Promise((resolve, reject) => {
      if (this.mode === 'process') {
        process.send(message, err => {
          if (err) reject(err);
          else resolve();
        });
      } else if (this.mode === 'worker') {
        this.parentPort.postMessage(message);
        resolve();
      }
    });
  }
  fetchClientValues(prop, shard) {
    return new Promise((resolve, reject) => {
      const parent = this.parentPort ?? process;
      const listener = message => {
        if (message?._sFetchProp !== prop || message._sFetchPropShard !== shard) return;
        parent.removeListener('message', listener);
        this.decrementMaxListeners(parent);
        if (!message._error) resolve(message._result);
        else reject(Util.makeError(message._error));
      };
      this.incrementMaxListeners(parent);
      parent.on('message', listener);
      this.send({ _sFetchProp: prop, _sFetchPropShard: shard }).catch(err => {
        parent.removeListener('message', listener);
        this.decrementMaxListeners(parent);
        reject(err);
      });
    });
  }
  broadcastEval(script, options = {}) {
    return new Promise((resolve, reject) => {
      const parent = this.parentPort ?? process;
      if (typeof script !== 'function') {
        reject(new TypeError('SHARDING_INVALID_EVAL_BROADCAST'));
        return;
      }
      script = `(${script})(this, ${JSON.stringify(options.context)})`;
      const listener = message => {
        if (message?._sEval !== script || message._sEvalShard !== options.shard) return;
        parent.removeListener('message', listener);
        this.decrementMaxListeners(parent);
        if (!message._error) resolve(message._result);
        else reject(Util.makeError(message._error));
      };
      this.incrementMaxListeners(parent);
      parent.on('message', listener);
      this.send({ _sEval: script, _sEvalShard: options.shard }).catch(err => {
        parent.removeListener('message', listener);
        this.decrementMaxListeners(parent);
        reject(err);
      });
    });
  }
  respawnAll({ shardDelay = 5_000, respawnDelay = 500, timeout = 30_000 } = {}) {
    return this.send({ _sRespawnAll: { shardDelay, respawnDelay, timeout } });
  }
  async _handleMessage(message) {
    if (!message) return;
    if (message._fetchProp) {
      try {
        const props = message._fetchProp.split('.');
        let value = this.client;
        for (const prop of props) value = value[prop];
        this._respond('fetchProp', { _fetchProp: message._fetchProp, _result: value });
      } catch (err) {
        this._respond('fetchProp', { _fetchProp: message._fetchProp, _error: Util.makePlainError(err) });
      }
    } else if (message._eval) {
      try {
        this._respond('eval', { _eval: message._eval, _result: await this.client._eval(message._eval) });
      } catch (err) {
        this._respond('eval', { _eval: message._eval, _error: Util.makePlainError(err) });
      }
    }
  }
  _respond(type, message) {
    this.send(message).catch(err => {
      const error = new Error(`Error when sending ${type} response to master process: ${err.message}`);
      error.stack = err.stack;
      this.client.emit(Events.ERROR, error);
    });
  }
  static singleton(client, mode) {
    if (!this._singleton) {
      this._singleton = new this(client, mode);
    } else {
      client.emit(
        Events.WARN,
        'Multiple clients created in child process/worker; only the first will handle sharding helpers.',
      );
    }
    return this._singleton;
  }
  static shardIdForGuildId(guildId, shardCount) {
    const shard = Number(BigInt(guildId) >> 22n) % shardCount;
    if (shard < 0) throw new Error('SHARDING_SHARD_MISCALCULATION', shard, guildId, shardCount);
    return shard;
  }
  incrementMaxListeners(emitter) {
    const maxListeners = emitter.getMaxListeners();
    if (maxListeners !== 0) {
      emitter.setMaxListeners(maxListeners + 1);
    }
  }
  decrementMaxListeners(emitter) {
    const maxListeners = emitter.getMaxListeners();
    if (maxListeners !== 0) {
      emitter.setMaxListeners(maxListeners - 1);
    }
  }
}
module.exports = ShardClientUtil;
