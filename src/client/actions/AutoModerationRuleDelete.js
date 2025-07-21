'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class AutoModerationRuleDeleteAction extends Action {
  handle(data) {
    const { client } = this;
    const guild = client.guilds.cache.get(data.guild_id);
    if (guild) {
      const autoModerationRule = guild.autoModerationRules.cache.get(data.id);
      if (autoModerationRule) {
        guild.autoModerationRules.cache.delete(autoModerationRule.id);
        client.emit(Events.AUTO_MODERATION_RULE_DELETE, autoModerationRule);
      }
    }
    return {};
  }
}
module.exports = AutoModerationRuleDeleteAction;
