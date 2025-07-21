'use strict';
const { setTimeout } = require('node:timers');
const { setTimeout: sleep } = require('node:timers/promises');
const { AsyncQueue } = require('@sapphire/async-queue');
const DiscordAPIError = require('./DiscordAPIError');
const HTTPError = require('./HTTPError');
const RateLimitError = require('./RateLimitError');
const {
  Events: { DEBUG, RATE_LIMIT, INVALID_REQUEST_WARNING, API_RESPONSE, API_REQUEST },
} = require('../util/Constants');
const TOTP = require('../util/Totp');
const captchaMessage = [
  'incorrect-captcha',
  'response-already-used',
  'captcha-required',
  'invalid-input-response',
  'invalid-response',
  'You need to update your app',
  'response-already-used-error',
  'rqkey-mismatch',
  'sitekey-secret-mismatch',
];
function parseResponse(res) {
  if (res.headers.get('content-type')?.startsWith('application/json')) return res.json();
  return res.arrayBuffer();
}
function getAPIOffset(serverDate) {
  return new Date(serverDate).getTime() - Date.now();
}
function calculateReset(reset, resetAfter, serverDate) {
  if (resetAfter) {
    return Date.now() + Number(resetAfter) * 1_000;
  }
  return new Date(Number(reset) * 1_000).getTime() - getAPIOffset(serverDate);
}
let invalidCount = 0;
let invalidCountResetTime = null;
class RequestHandler {
  constructor(manager) {
    this.manager = manager;
    this.queue = new AsyncQueue();
    this.reset = -1;
    this.remaining = -1;
    this.limit = -1;
  }
  async push(request) {
    await this.queue.wait();
    try {
      return await this.execute(request);
    } finally {
      this.queue.shift();
    }
  }
  get globalLimited() {
    return this.manager.globalRemaining <= 0 && Date.now() < this.manager.globalReset;
  }
  get localLimited() {
    return this.remaining <= 0 && Date.now() < this.reset;
  }
  get limited() {
    return this.globalLimited || this.localLimited;
  }
  get _inactive() {
    return this.queue.remaining === 0 && !this.limited;
  }
  globalDelayFor(ms) {
    return new Promise(resolve => {
      setTimeout(() => {
        this.manager.globalDelay = null;
        resolve();
      }, ms).unref();
    });
  }
  async onRateLimit(request, limit, timeout, isGlobal) {
    const { options } = this.manager.client;
    if (!options.rejectOnRateLimit) return;
    const rateLimitData = {
      timeout,
      limit,
      method: request.method,
      path: request.path,
      route: request.route,
      global: isGlobal,
    };
    const shouldThrow =
      typeof options.rejectOnRateLimit === 'function'
        ? await options.rejectOnRateLimit(rateLimitData)
        : options.rejectOnRateLimit.some(route => rateLimitData.route.startsWith(route.toLowerCase()));
    if (shouldThrow) {
      throw new RateLimitError(rateLimitData);
    }
  }
  async execute(request, captchaKey, captchaToken) {
    while (this.limited) {
      const isGlobal = this.globalLimited;
      let limit, timeout, delayPromise;
      if (isGlobal) {
        limit = this.manager.globalLimit;
        timeout = this.manager.globalReset + this.manager.client.options.restTimeOffset - Date.now();
      } else {
        limit = this.limit;
        timeout = this.reset + this.manager.client.options.restTimeOffset - Date.now();
      }
      if (this.manager.client.listenerCount(RATE_LIMIT)) {
        this.manager.client.emit(RATE_LIMIT, {
          timeout,
          limit,
          method: request.method,
          path: request.path,
          route: request.route,
          global: isGlobal,
        });
      }
      if (isGlobal) {
        if (!this.manager.globalDelay) {
          this.manager.globalDelay = this.globalDelayFor(timeout);
        }
        delayPromise = this.manager.globalDelay;
      } else {
        delayPromise = sleep(timeout);
      }
      await this.onRateLimit(request, limit, timeout, isGlobal); 
      await delayPromise; 
    }
    if (!this.manager.globalReset || this.manager.globalReset < Date.now()) {
      this.manager.globalReset = Date.now() + 1_000;
      this.manager.globalRemaining = this.manager.globalLimit;
    }
    this.manager.globalRemaining--;
    if (this.manager.client.listenerCount(API_REQUEST)) {
      this.manager.client.emit(API_REQUEST, {
        method: request.method,
        path: request.path,
        route: request.route,
        options: request.options,
        retries: request.retries,
      });
    }
    let res;
    try {
      res = await request.make(captchaKey, captchaToken);
    } catch (error) {
      if (request.retries === this.manager.client.options.retryLimit) {
        throw new HTTPError(error.message, error.constructor.name, error.status, request);
      }
      request.retries++;
      return this.execute(request);
    }
    if (this.manager.client.listenerCount(API_RESPONSE)) {
      this.manager.client.emit(
        API_RESPONSE,
        {
          method: request.method,
          path: request.path,
          route: request.route,
          options: request.options,
          retries: request.retries,
        },
        res.clone(),
      );
    }
    let sublimitTimeout;
    if (res.headers) {
      const serverDate = res.headers.get('date');
      const limit = res.headers.get('x-ratelimit-limit');
      const remaining = res.headers.get('x-ratelimit-remaining');
      const reset = res.headers.get('x-ratelimit-reset');
      const resetAfter = res.headers.get('x-ratelimit-reset-after');
      this.limit = limit ? Number(limit) : Infinity;
      this.remaining = remaining ? Number(remaining) : 1;
      this.reset = reset || resetAfter ? calculateReset(reset, resetAfter, serverDate) : Date.now();
      if (!resetAfter && request.route.includes('reactions')) {
        this.reset = new Date(serverDate).getTime() - getAPIOffset(serverDate) + 250;
      }
      let retryAfter = res.headers.get('retry-after');
      retryAfter = retryAfter ? Number(retryAfter) * 1_000 : -1;
      if (retryAfter > 0) {
        if (res.headers.get('x-ratelimit-global')) {
          this.manager.globalRemaining = 0;
          this.manager.globalReset = Date.now() + retryAfter;
        } else if (!this.localLimited) {
          sublimitTimeout = retryAfter;
        }
      }
    }
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      if (!invalidCountResetTime || invalidCountResetTime < Date.now()) {
        invalidCountResetTime = Date.now() + 1_000 * 60 * 10;
        invalidCount = 0;
      }
      invalidCount++;
      const emitInvalid =
        this.manager.client.listenerCount(INVALID_REQUEST_WARNING) &&
        this.manager.client.options.invalidRequestWarningInterval > 0 &&
        invalidCount % this.manager.client.options.invalidRequestWarningInterval === 0;
      if (emitInvalid) {
        this.manager.client.emit(INVALID_REQUEST_WARNING, {
          count: invalidCount,
          remainingTime: invalidCountResetTime - Date.now(),
        });
      }
    }
    if (res.ok) {
      return parseResponse(res);
    }
    if (res.status >= 400 && res.status < 500) {
      if (res.status === 429) {
        const isGlobal = this.globalLimited;
        let limit, timeout;
        if (isGlobal) {
          limit = this.manager.globalLimit;
          timeout = this.manager.globalReset + this.manager.client.options.restTimeOffset - Date.now();
        } else {
          limit = this.limit;
          timeout = this.reset + this.manager.client.options.restTimeOffset - Date.now();
        }
        this.manager.client.emit(
          DEBUG,
          `Hit a 429 while executing a request.
    Global  : ${isGlobal}
    Method  : ${request.method}
    Path    : ${request.path}
    Route   : ${request.route}
    Limit   : ${limit}
    Timeout : ${timeout}ms
    Sublimit: ${sublimitTimeout ? `${sublimitTimeout}ms` : 'None'}`,
        );
        await this.onRateLimit(request, limit, timeout, isGlobal);
        if (sublimitTimeout) {
          await sleep(sublimitTimeout);
        }
        return this.execute(request);
      }
      let data;
      try {
        data = await parseResponse(res);
        if (
          data?.captcha_service &&
          typeof this.manager.client.options.captchaSolver == 'function' &&
          request.retries < this.manager.client.options.captchaRetryLimit &&
          captchaMessage.some(s => data.captcha_key[0].includes(s))
        ) {
          this.manager.client.emit(
            DEBUG,
            `Hit a captcha while executing a request (${data.captcha_key.join(', ')})
    Method  : ${request.method}
    Path    : ${request.path}
    Route   : ${request.route}
    Sitekey : ${data.captcha_sitekey}
    rqToken : ${data.captcha_rqtoken}`,
          );
          const captcha = await this.manager.client.options.captchaSolver(data, request.fullUserAgent);
          this.manager.client.emit(
            DEBUG,
            `Captcha details:
    Method  : ${request.method}
    Path    : ${request.path}
    Route   : ${request.route}
    Key     : ${captcha ? `${captcha.slice(0, 120)}...` : '[Captcha not solved]'}
    rqToken : ${data.captcha_rqtoken}`,
          );
          request.retries++;
          return this.execute(request, captcha, data.captcha_rqtoken);
        }
        if (
          data?.code &&
          data.code == 60003 && 
          data.mfa.methods.find(o => o.type === 'totp') && 
          typeof this.manager.client.options.TOTPKey === 'string' &&
          request.options.auth !== false &&
          request.retries < 1
        ) {
          const { otp } = await TOTP.generate(this.manager.client.options.TOTPKey);
          this.manager.client.emit(
            DEBUG,
            `${data.message}
    Method  : ${request.method}
    Path    : ${request.path}
    Route   : ${request.route}
    mfaCode : ${otp}`,
          );
          const mfaData = data.mfa;
          const mfaPost = await this.manager.client.api.mfa.finish.post({
            data: {
              ticket: mfaData.ticket,
              data: otp,
              mfa_type: 'totp',
            },
          });
          request.options.mfaToken = mfaPost.token;
          request.retries++;
          return this.execute(request);
        }
      } catch (err) {
        throw new HTTPError(err.message, err.constructor.name, err.status, request);
      }
      throw new DiscordAPIError(data, res.status, request);
    }
    if (res.status >= 500 && res.status < 600) {
      if (request.retries === this.manager.client.options.retryLimit) {
        throw new HTTPError(res.statusText, res.constructor.name, res.status, request);
      }
      request.retries++;
      return this.execute(request);
    }
    return null;
  }
}
module.exports = RequestHandler;
