'use strict';
const EventEmitter = require('node:events');
const path = require('node:path');
const process = require('node:process');
const { setTimeout } = require('node:timers');
const { setTimeout: sleep } = require('node:timers/promises');
const { Error } = require('../errors');
const Util = require('../util/Util');
let childProcess = null;
let Worker = null;
class Shard extends EventEmitter {
  constructor(manager, id) {
    super();
    if (manager.mode === 'process') childProcess = require('node:child_process');
    else if (manager.mode === 'worker') Worker = require('node:worker_threads').Worker;
    this.manager = manager;
    this.id = id;
    this.args = manager.shardArgs ?? [];
    this.execArgv = manager.execArgv;
    this.env = Object.assign({}, process.env, {
      SHARDING_MANAGER: true,
      SHARDS: this.id,
      SHARD_COUNT: this.manager.totalShards,
      DISCORD_TOKEN: this.manager.token,
    });
    this.ready = false;
    this.process = null;
    this.worker = null;
    this._evals = new Map();
    this._fetches = new Map();
    this._exitListener = null;
  }
  spawn(timeout = 30_000) {
    if (this.process) throw new Error('SHARDING_PROCESS_EXISTS', this.id);
    if (this.worker) throw new Error('SHARDING_WORKER_EXISTS', this.id);
    this._exitListener = this._handleExit.bind(this, undefined, timeout);
    if (this.manager.mode === 'process') {
      this.process = childProcess
        .fork(path.resolve(this.manager.file), this.args, {
          env: this.env,
          execArgv: this.execArgv,
        })
        .on('message', this._handleMessage.bind(this))
        .on('exit', this._exitListener);
    } else if (this.manager.mode === 'worker') {
      this.worker = new Worker(path.resolve(this.manager.file), { workerData: this.env })
        .on('message', this._handleMessage.bind(this))
        .on('exit', this._exitListener);
    }
    this._evals.clear();
    this._fetches.clear();
    const child = this.process ?? this.worker;
    this.emit('spawn', child);
    if (timeout === -1 || timeout === Infinity) return Promise.resolve(child);
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(spawnTimeoutTimer);
        this.off('ready', onReady);
        this.off('disconnect', onDisconnect);
        this.off('death', onDeath);
      };
      const onReady = () => {
        cleanup();
        resolve(child);
      };
      const onDisconnect = () => {
        cleanup();
        reject(new Error('SHARDING_READY_DISCONNECTED', this.id));
      };
      const onDeath = () => {
        cleanup();
        reject(new Error('SHARDING_READY_DIED', this.id));
      };
      const onTimeout = () => {
        cleanup();
        reject(new Error('SHARDING_READY_TIMEOUT', this.id));
      };
      const spawnTimeoutTimer = setTimeout(onTimeout, timeout);
      this.once('ready', onReady);
      this.once('disconnect', onDisconnect);
      this.once('death', onDeath);
    });
  }
  kill() {
    if (this.process) {
      this.process.removeListener('exit', this._exitListener);
      this.process.kill();
    } else {
      this.worker.removeListener('exit', this._exitListener);
      this.worker.terminate();
    }
    this._handleExit(false);
  }
  async respawn({ delay = 500, timeout = 30_000 } = {}) {
    this.kill();
    if (delay > 0) await sleep(delay);
    return this.spawn(timeout);
  }
  send(message) {
    return new Promise((resolve, reject) => {
      if (this.process) {
        this.process.send(message, err => {
          if (err) reject(err);
          else resolve(this);
        });
      } else {
        this.worker.postMessage(message);
        resolve(this);
      }
    });
  }
  async fetchClientValue(prop) {
    if (!this.process && !this.worker) throw new Error('SHARDING_NO_CHILD_EXISTS', this.id);
    if (this._fetches.has(prop)) return this._fetches.get(prop);
    const promise = new Promise((resolve, reject) => {
      const child = this.process ?? this.worker;
      const listener = message => {
        if (message?._fetchProp !== prop) return;
        child.removeListener('message', listener);
        this.decrementMaxListeners(child);
        this._fetches.delete(prop);
        if (!message._error) resolve(message._result);
        else reject(Util.makeError(message._error));
      };
      this.incrementMaxListeners(child);
      child.on('message', listener);
      this.send({ _fetchProp: prop }).catch(err => {
        child.removeListener('message', listener);
        this.decrementMaxListeners(child);
        this._fetches.delete(prop);
        reject(err);
      });
    });
    this._fetches.set(prop, promise);
    return promise;
  }
  async eval(script, context) {
    const _eval = typeof script === 'function' ? `(${script})(this, ${JSON.stringify(context)})` : script;
    if (!this.process && !this.worker) throw new Error('SHARDING_NO_CHILD_EXISTS', this.id);
    if (this._evals.has(_eval)) return this._evals.get(_eval);
    const promise = new Promise((resolve, reject) => {
      const child = this.process ?? this.worker;
      const listener = message => {
        if (message?._eval !== _eval) return;
        child.removeListener('message', listener);
        this.decrementMaxListeners(child);
        this._evals.delete(_eval);
        if (!message._error) resolve(message._result);
        else reject(Util.makeError(message._error));
      };
      this.incrementMaxListeners(child);
      child.on('message', listener);
      this.send({ _eval }).catch(err => {
        child.removeListener('message', listener);
        this.decrementMaxListeners(child);
        this._evals.delete(_eval);
        reject(err);
      });
    });
    this._evals.set(_eval, promise);
    return promise;
  }
  _handleMessage(message) {
    if (message) {
      if (message._ready) {
        this.ready = true;
        this.emit('ready');
        return;
      }
      if (message._disconnect) {
        this.ready = false;
        this.emit('disconnect');
        return;
      }
      if (message._reconnecting) {
        this.ready = false;
        this.emit('reconnecting');
        return;
      }
      if (message._sFetchProp) {
        const resp = { _sFetchProp: message._sFetchProp, _sFetchPropShard: message._sFetchPropShard };
        this.manager.fetchClientValues(message._sFetchProp, message._sFetchPropShard).then(
          results => this.send({ ...resp, _result: results }),
          err => this.send({ ...resp, _error: Util.makePlainError(err) }),
        );
        return;
      }
      if (message._sEval) {
        const resp = { _sEval: message._sEval, _sEvalShard: message._sEvalShard };
        this.manager._performOnShards('eval', [message._sEval], message._sEvalShard).then(
          results => this.send({ ...resp, _result: results }),
          err => this.send({ ...resp, _error: Util.makePlainError(err) }),
        );
        return;
      }
      if (message._sRespawnAll) {
        const { shardDelay, respawnDelay, timeout } = message._sRespawnAll;
        this.manager.respawnAll({ shardDelay, respawnDelay, timeout }).catch(() => {
        });
        return;
      }
    }
    this.emit('message', message);
  }
  _handleExit(respawn = this.manager.respawn, timeout) {
    this.emit('death', this.process ?? this.worker);
    this.ready = false;
    this.process = null;
    this.worker = null;
    this._evals.clear();
    this._fetches.clear();
    if (respawn) this.spawn(timeout).catch(err => this.emit('error', err));
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
module.exports = Shard;
