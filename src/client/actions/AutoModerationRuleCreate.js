'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class AutoModerationRuleCreateAction extends Action {
  handle(data) {
    const { client } = this;
    const guild = client.guilds.cache.get(data.guild_id);
    if (guild) {
      const autoModerationRule = guild.autoModerationRules._add(data);
      client.emit(Events.AUTO_MODERATION_RULE_CREATE, autoModerationRule);
    }
    return {};
  }
}
module.exports = AutoModerationRuleCreateAction;
