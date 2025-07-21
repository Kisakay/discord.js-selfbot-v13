'use strict';
const { Events, Opcodes, Status } = require('../../../util/Constants');
const run = (client, guild) => {
  const subs = {};
  subs[guild.id] = {
    typing: true,
    threads: true,
    activities: true,
    member_updates: true,
    thread_member_lists: [],
    members: [],
    channels: {},
  };
  client.ws.broadcast({
    op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
    d: {
      subscriptions: subs,
    },
  });
};
module.exports = (client, { d: data }, shard) => {
  let guild = client.guilds.cache.get(data.id);
  run(client, data);
  if (guild) {
    if (!guild.available && !data.unavailable) {
      guild._patch(data);
      client.emit(Events.GUILD_AVAILABLE, guild);
    }
  } else {
    data.shardId = shard.id;
    guild = client.guilds._add(data);
    if (client.ws.status === Status.READY) {
      client.emit(Events.GUILD_CREATE, guild);
      run(client, guild);
    }
  }
};
