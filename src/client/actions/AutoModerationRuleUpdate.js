'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class AutoModerationRuleUpdateAction extends Action {
  handle(data) {
    const { client } = this;
    const guild = client.guilds.cache.get(data.guild_id);
    if (guild) {
      const oldAutoModerationRule = guild.autoModerationRules.cache.get(data.id)?._clone() ?? null;
      const newAutoModerationRule = guild.autoModerationRules._add(data);
      client.emit(Events.AUTO_MODERATION_RULE_UPDATE, oldAutoModerationRule, newAutoModerationRule);
    }
    return {};
  }
}
module.exports = AutoModerationRuleUpdateAction;
