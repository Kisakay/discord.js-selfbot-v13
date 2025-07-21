'use strict';
const { Events } = require('../../../util/Constants');
module.exports = (client, { d: data }) => {
  const commandManager = data.guild_id ? client.guilds.cache.get(data.guild_id)?.commands : client.application.commands;
  if (!commandManager) return;
  const isOwn = data.application_id === client.application.id;
  const command = commandManager._add(data, isOwn);
  if (isOwn) commandManager.cache.delete(data.id);
  client.emit(Events.APPLICATION_COMMAND_DELETE, command);
};
