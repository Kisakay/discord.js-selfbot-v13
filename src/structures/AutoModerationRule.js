'use strict';
const { Collection } = require('@discordjs/collection');
const Base = require('./Base');
const {
  AutoModerationRuleKeywordPresetTypes,
  AutoModerationRuleTriggerTypes,
  AutoModerationRuleEventTypes,
  AutoModerationActionTypes,
} = require('../util/Constants');
class AutoModerationRule extends Base {
  constructor(client, data, guild) {
    super(client);
    this.id = data.id;
    this.guild = guild;
    this.creatorId = data.creator_id;
    this.triggerType = AutoModerationRuleTriggerTypes[data.trigger_type];
    this._patch(data);
  }
  _patch(data) {
    if ('name' in data) {
      this.name = data.name;
    }
    if ('event_type' in data) {
      this.eventType = AutoModerationRuleEventTypes[data.event_type];
    }
    if ('trigger_metadata' in data) {
      this.triggerMetadata = {
        keywordFilter: data.trigger_metadata.keyword_filter ?? [],
        regexPatterns: data.trigger_metadata.regex_patterns ?? [],
        presets: data.trigger_metadata.presets?.map(preset => AutoModerationRuleKeywordPresetTypes[preset]) ?? [],
        allowList: data.trigger_metadata.allow_list ?? [],
        mentionTotalLimit: data.trigger_metadata.mention_total_limit ?? null,
        mentionRaidProtectionEnabled: data.trigger_metadata.mention_raid_protection_enabled ?? false,
      };
    }
    if ('actions' in data) {
      this.actions = data.actions.map(action => ({
        type: AutoModerationActionTypes[action.type],
        metadata: {
          durationSeconds: action.metadata.duration_seconds ?? null,
          channelId: action.metadata.channel_id ?? null,
          customMessage: action.metadata.custom_message ?? null,
        },
      }));
    }
    if ('enabled' in data) {
      this.enabled = data.enabled;
    }
    if ('exempt_roles' in data) {
      this.exemptRoles = new Collection(
        data.exempt_roles.map(exemptRole => [exemptRole, this.guild.roles.cache.get(exemptRole)]),
      );
    }
    if ('exempt_channels' in data) {
      this.exemptChannels = new Collection(
        data.exempt_channels.map(exemptChannel => [exemptChannel, this.guild.channels.cache.get(exemptChannel)]),
      );
    }
  }
  edit(options) {
    return this.guild.autoModerationRules.edit(this.id, options);
  }
  delete(reason) {
    return this.guild.autoModerationRules.delete(this.id, reason);
  }
  setName(name, reason) {
    return this.edit({ name, reason });
  }
  setEventType(eventType, reason) {
    return this.edit({ eventType, reason });
  }
  setKeywordFilter(keywordFilter, reason) {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, keywordFilter }, reason });
  }
  setRegexPatterns(regexPatterns, reason) {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, regexPatterns }, reason });
  }
  setPresets(presets, reason) {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, presets }, reason });
  }
  setAllowList(allowList, reason) {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, allowList }, reason });
  }
  setMentionTotalLimit(mentionTotalLimit, reason) {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, mentionTotalLimit }, reason });
  }
  setMentionRaidProtectionEnabled(mentionRaidProtectionEnabled, reason) {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, mentionRaidProtectionEnabled }, reason });
  }
  setActions(actions, reason) {
    return this.edit({ actions, reason });
  }
  setEnabled(enabled = true, reason) {
    return this.edit({ enabled, reason });
  }
  setExemptRoles(exemptRoles, reason) {
    return this.edit({ exemptRoles, reason });
  }
  setExemptChannels(exemptChannels, reason) {
    return this.edit({ exemptChannels, reason });
  }
}
module.exports = AutoModerationRule;
