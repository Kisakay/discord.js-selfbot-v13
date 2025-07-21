'use strict';
const EventEmitter = require('node:events');
const { setImmediate } = require('node:timers');
const { setTimeout: sleep } = require('node:timers/promises');
const { Collection } = require('@discordjs/collection');
const { RPCErrorCodes } = require('discord-api-types/v10');
const WebSocketShard = require('./WebSocketShard');
const PacketHandlers = require('./handlers');
const { Error } = require('../../errors');
const { Events, ShardEvents, Status, WSCodes, WSEvents } = require('../../util/Constants');
const BeforeReadyWhitelist = [
  WSEvents.READY,
  WSEvents.RESUMED,
  WSEvents.GUILD_CREATE,
  WSEvents.GUILD_DELETE,
  WSEvents.GUILD_MEMBERS_CHUNK,
  WSEvents.GUILD_MEMBER_ADD,
  WSEvents.GUILD_MEMBER_REMOVE,
];
const UNRECOVERABLE_CLOSE_CODES = Object.keys(WSCodes).slice(2).map(Number);
const UNRESUMABLE_CLOSE_CODES = [
  RPCErrorCodes.UnknownError,
  RPCErrorCodes.InvalidPermissions,
  RPCErrorCodes.InvalidClientId,
];
class WebSocketManager extends EventEmitter {
  constructor(client) {
    super();
    Object.defineProperty(this, 'client', { value: client });
    this.gateway = null;
    this.totalShards = this.client.options.shards.length;
    this.shards = new Collection();
    Object.defineProperty(this, 'shardQueue', { value: new Set(), writable: true });
    Object.defineProperty(this, 'packetQueue', { value: [] });
    this.status = Status.IDLE;
    this.destroyed = false;
    this.reconnecting = false;
  }
  get ping() {
    const sum = this.shards.reduce((a, b) => a + b.ping, 0);
    return sum / this.shards.size;
  }
  debug(message, shard) {
    this.client.emit(Events.DEBUG, `[WS => ${shard ? `Shard ${shard.id}` : 'Manager'}] ${message}`);
  }
  async connect() {
    let gatewayURL = 'wss://gateway.discord.gg';
    await this.client.api.gateway
      .get({ auth: false })
      .then(r => (gatewayURL = r.url))
      .catch(() => {});
    const total = Infinity;
    const remaining = Infinity;
    const recommendedShards = 1;
    this.debug(`Fetched Gateway Information
    URL: ${gatewayURL}
    Recommended Shards: ${recommendedShards}`);
    this.debug(`Session Limit Information
    Total: ${total}
    Remaining: ${remaining}`);
    this.gateway = `${gatewayURL}/`;
    let { shards } = this.client.options;
    if (shards === 'auto') {
      this.debug(`Using the recommended shard count provided by Discord: ${recommendedShards}`);
      this.totalShards = this.client.options.shardCount = recommendedShards;
      shards = this.client.options.shards = Array.from({ length: recommendedShards }, (_, i) => i);
    }
    this.totalShards = shards.length;
    this.debug(`Spawning shards: ${shards.join(', ')}`);
    this.shardQueue = new Set(shards.map(id => new WebSocketShard(this, id)));
    return this.createShards();
  }
  async createShards() {
    if (!this.shardQueue.size) return false;
    const [shard] = this.shardQueue;
    this.shardQueue.delete(shard);
    if (!shard.eventsAttached) {
      shard.on(ShardEvents.ALL_READY, unavailableGuilds => {
        this.client.emit(Events.SHARD_READY, shard.id, unavailableGuilds);
        if (!this.shardQueue.size) this.reconnecting = false;
        this.checkShardsReady();
      });
      shard.on(ShardEvents.CLOSE, event => {
        if (event.code === 1_000 ? this.destroyed : UNRECOVERABLE_CLOSE_CODES.includes(event.code)) {
          this.client.emit(Events.SHARD_DISCONNECT, event, shard.id);
          this.debug(WSCodes[event.code], shard);
          return;
        }
        if (UNRESUMABLE_CLOSE_CODES.includes(event.code)) {
          shard.sessionId = null;
        }
        this.client.emit(Events.SHARD_RECONNECTING, shard.id);
        this.shardQueue.add(shard);
        if (shard.sessionId) this.debug(`Session id is present, attempting an immediate reconnect...`, shard);
        this.reconnect();
      });
      shard.on(ShardEvents.INVALID_SESSION, () => {
        this.client.emit(Events.SHARD_RECONNECTING, shard.id);
      });
      shard.on(ShardEvents.DESTROYED, () => {
        this.debug('Shard was destroyed but no WebSocket connection was present! Reconnecting...', shard);
        this.client.emit(Events.SHARD_RECONNECTING, shard.id);
        this.shardQueue.add(shard);
        this.reconnect();
      });
      shard.eventsAttached = true;
    }
    this.shards.set(shard.id, shard);
    try {
      await shard.connect();
    } catch (error) {
      if (error?.code && UNRECOVERABLE_CLOSE_CODES.includes(error.code)) {
        throw new Error(WSCodes[error.code]);
      } else if (!error || error.code) {
        this.debug('Failed to connect to the gateway, requeueing...', shard);
        this.shardQueue.add(shard);
      } else {
        throw error;
      }
    }
    if (this.shardQueue.size) {
      this.debug(`Shard Queue Size: ${this.shardQueue.size}; continuing in 5 seconds...`);
      await sleep(5_000);
      return this.createShards();
    }
    return true;
  }
  async reconnect() {
    if (this.reconnecting || this.status !== Status.READY) return false;
    this.reconnecting = true;
    try {
      await this.createShards();
    } catch (error) {
      this.debug(`Couldn't reconnect or fetch information about the gateway. ${error}`);
      if (error.httpStatus !== 401) {
        this.debug(`Possible network error occurred. Retrying in 5s...`);
        await sleep(5_000);
        this.reconnecting = false;
        return this.reconnect();
      }
      if (this.client.listenerCount(Events.INVALIDATED)) {
        this.client.emit(Events.INVALIDATED);
        this.destroy();
      } else {
        this.client.destroy();
      }
    } finally {
      this.reconnecting = false;
    }
    return true;
  }
  broadcast(packet) {
    for (const shard of this.shards.values()) shard.send(packet);
  }
  destroy() {
    if (this.destroyed) return;
    this.debug(`Manager was destroyed. Called by:\n${new Error('MANAGER_DESTROYED').stack}`);
    this.destroyed = true;
    this.shardQueue.clear();
    for (const shard of this.shards.values()) shard.destroy({ closeCode: 1_000, reset: true, emit: false, log: false });
  }
  handlePacket(packet, shard) {
    if (packet && this.status !== Status.READY) {
      if (!BeforeReadyWhitelist.includes(packet.t)) {
        this.packetQueue.push({ packet, shard });
        return false;
      }
    }
    if (this.packetQueue.length) {
      const item = this.packetQueue.shift();
      setImmediate(() => {
        this.handlePacket(item.packet, item.shard);
      }).unref();
    }
    if (packet && PacketHandlers[packet.t]) {
      PacketHandlers[packet.t](this.client, packet, shard);
    } else if (packet) {
      this.client.emit(Events.UNHANDLED_PACKET, packet, shard);
    }
    return true;
  }
  checkShardsReady() {
    if (this.status === Status.READY) return;
    if (this.shards.size !== this.totalShards || this.shards.some(s => s.status !== Status.READY)) {
      return;
    }
    this.triggerClientReady();
  }
  triggerClientReady() {
    this.status = Status.READY;
    this.client.readyAt = new Date();
    this.client.emit(Events.CLIENT_READY, this.client);
    this.handlePacket();
  }
}
module.exports = WebSocketManager;
