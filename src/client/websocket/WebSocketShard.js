'use strict';
const EventEmitter = require('node:events');
const { setTimeout, setInterval, clearTimeout } = require('node:timers');
const WebSocket = require('../../WebSocket');
const { Status, Events, ShardEvents, Opcodes, WSEvents, WSCodes } = require('../../util/Constants');
const Intents = require('../../util/Intents');
const Util = require('../../util/Util');
const STATUS_KEYS = Object.keys(Status);
const CONNECTION_STATE = Object.keys(WebSocket.WebSocket);
let zlib;
try {
  zlib = require('zlib-sync');
} catch {} 
class WebSocketShard extends EventEmitter {
  constructor(manager, id) {
    super();
    this.manager = manager;
    this.id = id;
    this.resumeURL = null;
    this.status = Status.IDLE;
    this.sequence = -1;
    this.closeSequence = 0;
    this.sessionId = null;
    this.ping = -1;
    this.lastPingTimestamp = -1;
    this.lastHeartbeatAcked = true;
    this.closeEmitted = false;
    Object.defineProperty(this, 'ratelimit', {
      value: {
        queue: [],
        total: 120,
        remaining: 120,
        time: 60e3,
        timer: null,
      },
    });
    Object.defineProperty(this, 'connection', { value: null, writable: true });
    Object.defineProperty(this, 'inflate', { value: null, writable: true });
    Object.defineProperty(this, 'helloTimeout', { value: null, writable: true });
    Object.defineProperty(this, 'wsCloseTimeout', { value: null, writable: true });
    Object.defineProperty(this, 'eventsAttached', { value: false, writable: true });
    Object.defineProperty(this, 'expectedGuilds', { value: null, writable: true });
    Object.defineProperty(this, 'readyTimeout', { value: null, writable: true });
    Object.defineProperty(this, 'connectedAt', { value: 0, writable: true });
  }
  debug(message) {
    this.manager.debug(message, this);
  }
  connect() {
    const { client } = this.manager;
    if (this.connection?.readyState === WebSocket.OPEN && this.status === Status.READY) {
      return Promise.resolve();
    }
    const gateway = this.resumeURL ?? this.manager.gateway;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.removeListener(ShardEvents.CLOSE, onClose);
        this.removeListener(ShardEvents.READY, onReady);
        this.removeListener(ShardEvents.RESUMED, onResumed);
        this.removeListener(ShardEvents.INVALID_SESSION, onInvalidOrDestroyed);
        this.removeListener(ShardEvents.DESTROYED, onInvalidOrDestroyed);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onResumed = () => {
        cleanup();
        resolve();
      };
      const onClose = event => {
        cleanup();
        reject(event);
      };
      const onInvalidOrDestroyed = () => {
        cleanup();
        reject();
      };
      this.once(ShardEvents.READY, onReady);
      this.once(ShardEvents.RESUMED, onResumed);
      this.once(ShardEvents.CLOSE, onClose);
      this.once(ShardEvents.INVALID_SESSION, onInvalidOrDestroyed);
      this.once(ShardEvents.DESTROYED, onInvalidOrDestroyed);
      if (this.connection?.readyState === WebSocket.OPEN) {
        this.debug('An open connection was found, attempting an immediate identify.');
        this.identify();
        return;
      }
      if (this.connection) {
        this.debug(`A connection object was found. Cleaning up before continuing.
    State: ${CONNECTION_STATE[this.connection.readyState]}`);
        this.destroy({ emit: false });
      }
      const wsQuery = { v: client.options.ws.version };
      if (zlib) {
        this.inflate = new zlib.Inflate({
          chunkSize: 65535,
          flush: zlib.Z_SYNC_FLUSH,
          to: WebSocket.encoding === 'json' ? 'string' : '',
        });
        wsQuery.compress = 'zlib-stream';
      }
      this.debug(
        `[CONNECT]
    Gateway    : ${gateway}
    Version    : ${client.options.ws.version}
    Encoding   : ${WebSocket.encoding}
    Compression: ${zlib ? 'zlib-stream' : 'none'}
    Agent      : ${Util.verifyProxyAgent(client.options.ws.agent)}`,
      );
      this.status = this.status === Status.DISCONNECTED ? Status.RECONNECTING : Status.CONNECTING;
      this.setHelloTimeout();
      this.setWsCloseTimeout(-1);
      this.connectedAt = Date.now();
      const ws = (this.connection = WebSocket.create(gateway, wsQuery, {
        handshakeTimeout: 30_000,
        agent: Util.verifyProxyAgent(client.options.ws.agent) ? client.options.ws.agent : undefined,
      }));
      ws.onopen = this.onOpen.bind(this);
      ws.onmessage = this.onMessage.bind(this);
      ws.onerror = this.onError.bind(this);
      ws.onclose = this.onClose.bind(this);
    });
  }
  onOpen() {
    this.debug(`[CONNECTED] Took ${Date.now() - this.connectedAt}ms`);
    this.status = Status.NEARLY;
  }
  onMessage({ data }) {
    let raw;
    if (data instanceof ArrayBuffer) data = new Uint8Array(data);
    if (zlib) {
      const l = data.length;
      const flush =
        l >= 4 && data[l - 4] === 0x00 && data[l - 3] === 0x00 && data[l - 2] === 0xff && data[l - 1] === 0xff;
      this.inflate.push(data, flush && zlib.Z_SYNC_FLUSH);
      if (!flush) return;
      raw = this.inflate.result;
    } else {
      raw = data;
    }
    let packet;
    try {
      packet = WebSocket.unpack(raw);
    } catch (err) {
      this.manager.client.emit(Events.SHARD_ERROR, err, this.id);
      return;
    }
    this.manager.client.emit(Events.RAW, packet, this.id);
    if (packet.op === Opcodes.DISPATCH) this.manager.emit(packet.t, packet.d, this.id);
    this.onPacket(packet);
  }
  onError(event) {
    const error = event?.error ?? event;
    if (!error) return;
    this.manager.client.emit(Events.SHARD_ERROR, error, this.id);
  }
  onClose(event) {
    this.closeEmitted = true;
    if (this.sequence !== -1) this.closeSequence = this.sequence;
    this.sequence = -1;
    this.setHeartbeatTimer(-1);
    this.setHelloTimeout(-1);
    this.setWsCloseTimeout(-1);
    if (this.connection) {
      this._cleanupConnection();
      this.destroy({ reset: !this.sessionId, emit: false, log: false });
    }
    this.status = Status.DISCONNECTED;
    this.emitClose(event);
  }
  emitClose(
    event = {
      code: 1011,
      reason: WSCodes[1011],
      wasClean: false,
    },
  ) {
    this.debug(`[CLOSE]
    Event Code: ${event.code}
    Clean     : ${event.wasClean}
    Reason    : ${event.reason ?? 'No reason received'}`);
    this.emit(ShardEvents.CLOSE, event);
  }
  onPacket(packet) {
    if (!packet) {
      this.debug(`Received broken packet: '${packet}'.`);
      return;
    }
    switch (packet.t) {
      case WSEvents.READY:
        this.emit(ShardEvents.READY);
        this.resumeURL = packet.d.resume_gateway_url;
        this.sessionId = packet.d.session_id;
        this.expectedGuilds = new Set(packet.d.guilds.filter(d => d?.unavailable == true).map(d => d.id));
        this.status = Status.WAITING_FOR_GUILDS;
        this.debug(`[READY] Session ${this.sessionId} | Resume url ${this.resumeURL}.`);
        this.lastHeartbeatAcked = true;
        this.sendHeartbeat('ReadyHeartbeat');
        break;
      case WSEvents.RESUMED: {
        this.emit(ShardEvents.RESUMED);
        this.status = Status.READY;
        const replayed = packet.s - this.closeSequence;
        this.debug(`[RESUMED] Session ${this.sessionId} | Replayed ${replayed} events.`);
        this.lastHeartbeatAcked = true;
        this.sendHeartbeat('ResumeHeartbeat');
        break;
      }
    }
    if (packet.s > this.sequence) this.sequence = packet.s;
    switch (packet.op) {
      case Opcodes.HELLO:
        this.setHelloTimeout(-1);
        this.setHeartbeatTimer(packet.d.heartbeat_interval);
        this.identify();
        break;
      case Opcodes.RECONNECT:
        this.debug('[RECONNECT] Discord asked us to reconnect');
        this.destroy({ closeCode: 4_000 });
        break;
      case Opcodes.INVALID_SESSION:
        this.debug(`[INVALID SESSION] Resumable: ${packet.d}.`);
        if (packet.d) {
          this.identifyResume();
          return;
        }
        this.sequence = -1;
        this.sessionId = null;
        this.status = Status.RECONNECTING;
        this.emit(ShardEvents.INVALID_SESSION);
        break;
      case Opcodes.HEARTBEAT_ACK:
        this.ackHeartbeat();
        break;
      case Opcodes.HEARTBEAT:
        this.sendHeartbeat('HeartbeatRequest', true);
        break;
      default:
        this.manager.handlePacket(packet, this);
        if (this.status === Status.WAITING_FOR_GUILDS && packet.t === WSEvents.GUILD_CREATE) {
          this.expectedGuilds.delete(packet.d.id);
          this.checkReady();
        }
    }
  }
  checkReady() {
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
    }
    if (!this.expectedGuilds.size) {
      this.debug('Shard received all its guilds. Marking as fully ready.');
      this.status = Status.READY;
      this.emit(ShardEvents.ALL_READY);
      return;
    }
    const hasGuildsIntent = new Intents(this.manager.client.options.intents).has(Intents.FLAGS.GUILDS);
    const { waitGuildTimeout } = this.manager.client.options;
    this.readyTimeout = setTimeout(
      () => {
        this.debug(
          `Shard ${hasGuildsIntent ? 'did' : 'will'} not receive any more guild packets` +
            `${hasGuildsIntent ? ` in ${waitGuildTimeout} ms` : ''}.\nUnavailable guild count: ${
              this.expectedGuilds.size
            }`,
        );
        this.readyTimeout = null;
        this.status = Status.READY;
        this.emit(ShardEvents.ALL_READY, this.expectedGuilds);
      },
      hasGuildsIntent ? waitGuildTimeout : 0,
    ).unref();
  }
  setHelloTimeout(time) {
    if (time === -1) {
      if (this.helloTimeout) {
        this.debug('Clearing the HELLO timeout.');
        clearTimeout(this.helloTimeout);
        this.helloTimeout = null;
      }
      return;
    }
    this.debug('Setting a HELLO timeout for 20s.');
    this.helloTimeout = setTimeout(() => {
      this.debug('Did not receive HELLO in time. Destroying and connecting again.');
      this.destroy({ reset: true, closeCode: 4009 });
    }, 20_000).unref();
  }
  setWsCloseTimeout(time) {
    if (this.wsCloseTimeout) {
      this.debug('[WebSocket] Clearing the close timeout.');
      clearTimeout(this.wsCloseTimeout);
    }
    if (time === -1) {
      this.wsCloseTimeout = null;
      return;
    }
    this.wsCloseTimeout = setTimeout(() => {
      this.setWsCloseTimeout(-1);
      if (this.closeEmitted) {
        this.debug(`[WebSocket] close was already emitted, assuming the connection was closed properly.`);
        this.closeEmitted = false;
        return;
      }
      this.debug(
        `[WebSocket] Close Emitted: ${this.closeEmitted} | did not close properly, assuming a zombie connection.\nEmitting close and reconnecting again.`,
      );
      if (this.connection) this._cleanupConnection();
      this.emitClose({
        code: 4009,
        reason: 'Session time out.',
        wasClean: false,
      });
    }, time);
  }
  setHeartbeatTimer(time) {
    if (time === -1) {
      if (this.heartbeatInterval) {
        this.debug('Clearing the heartbeat interval.');
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      return;
    }
    this.debug(`Setting a heartbeat interval for ${time}ms.`);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), time).unref();
  }
  sendHeartbeat(
    tag = 'HeartbeatTimer',
    ignoreHeartbeatAck = [Status.WAITING_FOR_GUILDS, Status.IDENTIFYING, Status.RESUMING].includes(this.status),
  ) {
    if (ignoreHeartbeatAck && !this.lastHeartbeatAcked) {
      this.debug(`[${tag}] Didn't process heartbeat ack yet but we are still connected. Sending one now.`);
    } else if (!this.lastHeartbeatAcked) {
      this.debug(
        `[${tag}] Didn't receive a heartbeat ack last time, assuming zombie connection. Destroying and reconnecting.
    Status          : ${STATUS_KEYS[this.status]}
    Sequence        : ${this.sequence}
    Connection State: ${this.connection ? CONNECTION_STATE[this.connection.readyState] : 'No Connection??'}`,
      );
      this.destroy({ reset: true, closeCode: 4009 });
      return;
    }
    this.debug(`[${tag}] Sending a heartbeat.`);
    this.lastHeartbeatAcked = false;
    this.lastPingTimestamp = Date.now();
    this.send({ op: Opcodes.HEARTBEAT, d: this.sequence }, true);
  }
  ackHeartbeat() {
    this.lastHeartbeatAcked = true;
    const latency = Date.now() - this.lastPingTimestamp;
    this.debug(`Heartbeat acknowledged, latency of ${latency}ms.`);
    this.ping = latency;
  }
  identify() {
    return this.sessionId ? this.identifyResume() : this.identifyNew();
  }
  identifyNew() {
    const { client } = this.manager;
    if (!client.token) {
      this.debug('[IDENTIFY] No token available to identify a new session.');
      return;
    }
    this.status = Status.IDENTIFYING;
    Object.keys(client.options.ws.properties)
      .filter(k => k.startsWith('$'))
      .forEach(k => {
        client.options.ws.properties[k.slice(1)] = client.options.ws.properties[k];
        delete client.options.ws.properties[k];
      });
    const d = {
      ...client.options.ws,
      token: client.token,
    };
    delete d.version;
    delete d.agent;
    this.debug(`[IDENTIFY] Shard ${this.id}`);
    this.send({ op: Opcodes.IDENTIFY, d }, true);
  }
  identifyResume() {
    if (!this.sessionId) {
      this.debug('[RESUME] No session id was present; identifying as a new session.');
      this.identifyNew();
      return;
    }
    this.status = Status.RESUMING;
    this.debug(`[RESUME] Session ${this.sessionId}, sequence ${this.closeSequence}`);
    const d = {
      token: this.manager.client.token,
      session_id: this.sessionId,
      seq: this.closeSequence,
    };
    this.send({ op: Opcodes.RESUME, d }, true);
  }
  send(data, important = false) {
    this.ratelimit.queue[important ? 'unshift' : 'push'](data);
    this.processQueue();
  }
  _send(data) {
    if (this.connection?.readyState !== WebSocket.OPEN) {
      this.debug(`Tried to send packet '${JSON.stringify(data)}' but no WebSocket is available!`);
      this.destroy({ closeCode: 4_000 });
      return;
    }
    this.debug(`[WebSocketShard] send packet '${JSON.stringify(data)}'`);
    this.connection.send(WebSocket.pack(data), err => {
      if (err) this.manager.client.emit(Events.SHARD_ERROR, err, this.id);
    });
  }
  processQueue() {
    if (this.ratelimit.remaining === 0) return;
    if (this.ratelimit.queue.length === 0) return;
    if (this.ratelimit.remaining === this.ratelimit.total) {
      this.ratelimit.timer = setTimeout(() => {
        this.ratelimit.remaining = this.ratelimit.total;
        this.processQueue();
      }, this.ratelimit.time).unref();
    }
    while (this.ratelimit.remaining > 0) {
      const item = this.ratelimit.queue.shift();
      if (!item) return;
      this._send(item);
      this.ratelimit.remaining--;
    }
  }
  destroy({ closeCode = 1_000, reset = false, emit = true, log = true } = {}) {
    if (log) {
      this.debug(`[DESTROY]
    Close Code    : ${closeCode}
    Reset         : ${reset}
    Emit DESTROYED: ${emit}`);
    }
    this.setHeartbeatTimer(-1);
    this.setHelloTimeout(-1);
    this.debug(
      `[WebSocket] Destroy: Attempting to close the WebSocket. | WS State: ${
        CONNECTION_STATE[this.connection?.readyState ?? WebSocket.CLOSED]
      }`,
    );
    if (this.connection) {
      if (this.connection.readyState === WebSocket.OPEN) {
        this.connection.close(closeCode);
        this.debug(`[WebSocket] Close: Tried closing. | WS State: ${CONNECTION_STATE[this.connection.readyState]}`);
      } else {
        this.debug(`WS State: ${CONNECTION_STATE[this.connection.readyState]}`);
        try {
          this.connection.close(closeCode);
        } catch (err) {
          this.debug(
            `[WebSocket] Close: Something went wrong while closing the WebSocket: ${
              err.message || err
            }. Forcefully terminating the connection | WS State: ${CONNECTION_STATE[this.connection.readyState]}`,
          );
          this.connection.terminate();
        }
        if (emit) this._emitDestroyed();
      }
    } else if (emit) {
      this._emitDestroyed();
    }
    this.debug(
      `[WebSocket] Adding a WebSocket close timeout to ensure a correct WS reconnect.
        Timeout: ${this.manager.client.options.closeTimeout}ms`,
    );
    this.setWsCloseTimeout(this.manager.client.options.closeTimeout);
    this.connection = null;
    this.status = Status.DISCONNECTED;
    if (this.sequence !== -1) this.closeSequence = this.sequence;
    if (reset) {
      this.resumeURL = null;
      this.sequence = -1;
      this.sessionId = null;
    }
    this.ratelimit.remaining = this.ratelimit.total;
    this.ratelimit.queue.length = 0;
    if (this.ratelimit.timer) {
      clearTimeout(this.ratelimit.timer);
      this.ratelimit.timer = null;
    }
  }
  _cleanupConnection() {
    this.connection.onopen = this.connection.onclose = this.connection.onmessage = null;
    this.connection.onerror = () => null;
  }
  _emitDestroyed() {
    this.emit(ShardEvents.DESTROYED);
  }
}
module.exports = WebSocketShard;
