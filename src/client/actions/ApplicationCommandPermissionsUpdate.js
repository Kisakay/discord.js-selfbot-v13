'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class ApplicationCommandPermissionsUpdateAction extends Action {
  handle(data) {
    const client = this.client;
    client.emit(Events.APPLICATION_COMMAND_PERMISSIONS_UPDATE, {
      permissions: data.permissions,
      id: data.id,
      guildId: data.guild_id,
      applicationId: data.application_id,
    });
  }
}
module.exports = ApplicationCommandPermissionsUpdateAction;
