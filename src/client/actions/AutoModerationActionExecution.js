'use strict';
const Action = require('./Action');
const AutoModerationActionExecution = require('../../structures/AutoModerationActionExecution');
const { Events } = require('../../util/Constants');
class AutoModerationActionExecutionAction extends Action {
  handle(data) {
    const { client } = this;
    const guild = client.guilds.cache.get(data.guild_id);
    if (guild) {
      client.emit(Events.AUTO_MODERATION_ACTION_EXECUTION, new AutoModerationActionExecution(data, guild));
    }
    return {};
  }
}
module.exports = AutoModerationActionExecutionAction;
