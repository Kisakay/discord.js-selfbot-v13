'use strict';
const { Events } = require('../../../util/Constants');
module.exports = (client, { d: data }) => {
  if (data.user) {
    client.users._add(data.user);
  }
  client.relationships.cache.set(data.id, data.type);
  client.relationships.friendNicknames.set(data.id, data.nickname);
  client.relationships.sinceCache.set(data.id, new Date(data.since || 0));
  client.emit(Events.RELATIONSHIP_ADD, data.id, Boolean(data.should_notify));
};
