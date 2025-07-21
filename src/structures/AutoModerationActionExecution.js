'use strict';
const { AutoModerationRuleTriggerTypes } = require('../util/Constants');
class AutoModerationActionExecution {
  constructor(data, guild) {
    this.guild = guild;
    this.action = data.action;
    this.ruleId = data.rule_id;
    this.ruleTriggerType = AutoModerationRuleTriggerTypes[data.rule_trigger_type];
    this.userId = data.user_id;
    this.channelId = data.channel_id ?? null;
    this.messageId = data.message_id ?? null;
    this.alertSystemMessageId = data.alert_system_message_id ?? null;
    this.content = data.content;
    this.matchedKeyword = data.matched_keyword ?? null;
    this.matchedContent = data.matched_content ?? null;
  }
  get autoModerationRule() {
    return this.guild.autoModerationRules.cache.get(this.ruleId) ?? null;
  }
}
module.exports = AutoModerationActionExecution;
