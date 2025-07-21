'use strict';
const USER_REQUIRED_ACTION = require('./USER_REQUIRED_ACTION_UPDATE');
const { Opcodes } = require('../../../util/Constants');
let ClientUser;
module.exports = (client, { d: data }, shard) => {
  USER_REQUIRED_ACTION(client, { d: data });
  client.presence.userId = data.user.id;
  if (client.user) {
    client.user._patch(data.user);
  } else {
    ClientUser ??= require('../../../structures/ClientUser');
    client.user = new ClientUser(client, data.user);
    client.users.cache.set(client.user.id, client.user);
  }
  for (const private_channel of data.private_channels) {
    client.channels._add(private_channel);
  }
  for (const guild of data.guilds) {
    guild.shardId = shard.id;
    client.guilds._add(guild);
  }
  client.notes._reload(data.notes);
  client.relationships._setup(data.relationships);
  client.settings._patch(data.user_settings);
  for (const gSetting of Array.isArray(data.user_guild_settings) ? data.user_guild_settings : []) {
    const guild = client.guilds.cache.get(gSetting.guild_id);
    if (guild) guild.settings._patch(gSetting);
  }
  if (data.guilds.length) {
    if (data.guilds.length > 80) {
      const data1 = data.guilds.slice(0, Math.floor(data.guilds.length / 2));
      const data2 = data.guilds.slice(Math.floor(data.guilds.length / 2));
      client.ws.broadcast({
        op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
        d: {
          subscriptions: data1.reduce((accumulator, guild) => {
            accumulator[guild.id] = {
              typing: true,
              threads: true,
              activities: true,
              member_updates: true,
              thread_member_lists: [],
              members: [],
              channels: {},
            };
            return accumulator;
          }, {}),
        },
      });
      client.ws.broadcast({
        op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
        d: {
          subscriptions: data2.reduce((accumulator, guild) => {
            accumulator[guild.id] = {
              typing: true,
              threads: true,
              activities: true,
              member_updates: true,
              thread_member_lists: [],
              members: [],
              channels: {},
            };
            return accumulator;
          }, {}),
        },
      });
    } else {
      client.ws.broadcast({
        op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
        d: {
          subscriptions: data.guilds.reduce((accumulator, guild) => {
            accumulator[guild.id] = {
              typing: true,
              threads: true,
              activities: true,
              member_updates: true,
              thread_member_lists: [],
              members: [],
              channels: {},
            };
            return accumulator;
          }, {}),
        },
      });
    }
  }
};
