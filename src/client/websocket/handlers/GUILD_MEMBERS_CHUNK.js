'use strict';
const { Collection } = require('@discordjs/collection');
const { Events } = require('../../../util/Constants');
module.exports = (client, { d: data }) => {
  const guild = client.guilds.cache.get(data.guild_id);
  if (!guild) return;
  const members = new Collection();
  for (const member of data.members) members.set(member.user.id, guild.members._add(member));
  if (data.presences) {
    for (const presence of data.presences) guild.presences._add(Object.assign(presence, { guild }));
  }
  client.emit(Events.GUILD_MEMBERS_CHUNK, members, guild, {
    count: data.chunk_count,
    index: data.chunk_index,
    nonce: data.nonce,
    notFound: data.not_found,
  });
};
