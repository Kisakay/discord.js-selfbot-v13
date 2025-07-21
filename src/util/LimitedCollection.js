'use strict';
const { setInterval } = require('node:timers');
const { Collection } = require('@discordjs/collection');
const { _cleanupSymbol } = require('./Constants.js');
const Sweepers = require('./Sweepers.js');
const { TypeError } = require('../errors/DJSError.js');
class LimitedCollection extends Collection {
  constructor(options = {}, iterable) {
    if (typeof options !== 'object' || options === null) {
      throw new TypeError('INVALID_TYPE', 'options', 'object', true);
    }
    const { maxSize = Infinity, keepOverLimit = null, sweepInterval = 0, sweepFilter = null } = options;
    if (typeof maxSize !== 'number') {
      throw new TypeError('INVALID_TYPE', 'maxSize', 'number');
    }
    if (keepOverLimit !== null && typeof keepOverLimit !== 'function') {
      throw new TypeError('INVALID_TYPE', 'keepOverLimit', 'function');
    }
    if (typeof sweepInterval !== 'number') {
      throw new TypeError('INVALID_TYPE', 'sweepInterval', 'number');
    }
    if (sweepFilter !== null && typeof sweepFilter !== 'function') {
      throw new TypeError('INVALID_TYPE', 'sweepFilter', 'function');
    }
    super(iterable);
    this.maxSize = maxSize;
    this.keepOverLimit = keepOverLimit;
    this.sweepFilter = sweepFilter;
    this.interval =
      sweepInterval > 0 && sweepInterval !== Infinity && sweepFilter
        ? setInterval(() => {
            const sweepFn = this.sweepFilter(this);
            if (sweepFn === null) return;
            if (typeof sweepFn !== 'function') throw new TypeError('SWEEP_FILTER_RETURN');
            this.sweep(sweepFn);
          }, sweepInterval * 1_000).unref()
        : null;
  }
  set(key, value) {
    if (this.maxSize === 0) return this;
    if (this.size >= this.maxSize && !this.has(key)) {
      for (const [k, v] of this.entries()) {
        const keep = this.keepOverLimit?.(v, k, this) ?? false;
        if (!keep) {
          this.delete(k);
          break;
        }
      }
    }
    return super.set(key, value);
  }
  static filterByLifetime({
    lifetime = 14400,
    getComparisonTimestamp = e => e?.createdTimestamp,
    excludeFromSweep = () => false,
  } = {}) {
    return Sweepers.filterByLifetime({ lifetime, getComparisonTimestamp, excludeFromSweep });
  }
  [_cleanupSymbol]() {
    return this.interval ? () => clearInterval(this.interval) : null;
  }
  static get [Symbol.species]() {
    return Collection;
  }
}
module.exports = LimitedCollection;
