'use strict';
const { Events } = require('../../../util/Constants');
module.exports = (client, { d: data }) => {
  const oldType = client.relationships.cache.get(data.id);
  const oldSince = client.relationships.sinceCache.get(data.id);
  const oldNickname = client.relationships.friendNicknames.get(data.id);
  if (data.type) client.relationships.cache.set(data.id, data.type);
  if (data.nickname) client.relationships.friendNicknames.set(data.id, data.nickname);
  if (data.since) client.relationships.sinceCache.set(data.id, new Date(data.since || 0));
  client.emit(
    Events.RELATIONSHIP_UPDATE,
    data.id,
    {
      type: oldType,
      nickname: oldNickname,
      since: oldSince,
    },
    {
      type: data.type,
      nickname: data.nickname,
      since: new Date(data.since || 0),
    },
  );
};
