'use strict';
const EventEmitter = require('node:events');
const process = require('node:process');
const RESTManager = require('../rest/RESTManager');
const Options = require('../util/Options');
const Util = require('../util/Util');
class BaseClient extends EventEmitter {
  constructor(options = {}) {
    super({ captureRejections: true });
    if (options.intents) {
      process.emitWarning('Intents is not available.', 'DeprecationWarning');
    }
    this.options = Util.mergeDefault(Options.createDefault(), options);
    this.rest = new RESTManager(this);
  }
  get api() {
    return this.rest.api;
  }
  destroy() {
    if (this.rest.sweepInterval) clearInterval(this.rest.sweepInterval);
  }
  incrementMaxListeners() {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners + 1);
    }
  }
  decrementMaxListeners() {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners - 1);
    }
  }
  toJSON(...props) {
    return Util.flatten(this, { domain: false }, ...props);
  }
}
module.exports = BaseClient;
