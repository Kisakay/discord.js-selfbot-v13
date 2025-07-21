'use strict';
const { Events } = require('../../../util/Constants');
module.exports = (client, { d: data }) => {
  const commandManager = data.guild_id ? client.guilds.cache.get(data.guild_id)?.commands : client.application.commands;
  if (!commandManager) return;
  const command = commandManager._add(data, data.application_id === client.application.id);
  client.emit(Events.APPLICATION_COMMAND_CREATE, command);
};
