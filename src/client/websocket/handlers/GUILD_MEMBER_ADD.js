'use strict';
const { Events, Status } = require('../../../util/Constants');
module.exports = (client, { d: data }, shard) => {
  const guild = client.guilds.cache.get(data.guild_id);
  if (guild) {
    guild.memberCount++;
    const member = guild.members._add(data);
    if (shard.status === Status.READY) {
      client.emit(Events.GUILD_MEMBER_ADD, member);
    }
  }
};
