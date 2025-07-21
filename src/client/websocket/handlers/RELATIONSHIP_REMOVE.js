'use strict';
const { Events } = require('../../../util/Constants');
module.exports = (client, { d: data }) => {
  client.relationships.cache.delete(data.id);
  client.relationships.friendNicknames.delete(data.id);
  client.relationships.sinceCache.delete(data.id);
  client.emit(Events.RELATIONSHIP_REMOVE, data.id, data.type, data.nickname);
};
