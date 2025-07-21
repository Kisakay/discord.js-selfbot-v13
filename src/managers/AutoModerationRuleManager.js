'use strict';
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const AutoModerationRule = require('../structures/AutoModerationRule');
const {
  AutoModerationRuleEventTypes,
  AutoModerationRuleTriggerTypes,
  AutoModerationActionTypes,
  AutoModerationRuleKeywordPresetTypes,
} = require('../util/Constants');
class AutoModerationRuleManager extends CachedManager {
  constructor(guild, iterable) {
    super(guild.client, AutoModerationRule, iterable);
    this.guild = guild;
  }
  _add(data, cache) {
    return super._add(data, cache, { extras: [this.guild] });
  }
  async create({
    name,
    eventType,
    triggerType,
    triggerMetadata,
    actions,
    enabled,
    exemptRoles,
    exemptChannels,
    reason,
  }) {
    const data = await this.client.api.guilds(this.guild.id)['auto-moderation'].rules.post({
      data: {
        name,
        event_type: typeof eventType === 'number' ? eventType : AutoModerationRuleEventTypes[eventType],
        trigger_type: typeof triggerType === 'number' ? triggerType : AutoModerationRuleTriggerTypes[triggerType],
        trigger_metadata: triggerMetadata && {
          keyword_filter: triggerMetadata.keywordFilter,
          regex_patterns: triggerMetadata.regexPatterns,
          presets: triggerMetadata.presets?.map(preset =>
            typeof preset === 'number' ? preset : AutoModerationRuleKeywordPresetTypes[preset],
          ),
          allow_list: triggerMetadata.allowList,
          mention_total_limit: triggerMetadata.mentionTotalLimit,
          mention_raid_protection_enabled: triggerMetadata.mentionRaidProtectionEnabled,
        },
        actions: actions.map(action => ({
          type: typeof action.type === 'number' ? action.type : AutoModerationActionTypes[action.type],
          metadata: {
            duration_seconds: action.metadata?.durationSeconds,
            channel_id: action.metadata?.channel && this.guild.channels.resolveId(action.metadata.channel),
            custom_message: action.metadata?.customMessage,
          },
        })),
        enabled,
        exempt_roles: exemptRoles?.map(exemptRole => this.guild.roles.resolveId(exemptRole)),
        exempt_channels: exemptChannels?.map(exemptChannel => this.guild.channels.resolveId(exemptChannel)),
      },
      reason,
    });
    return this._add(data);
  }
  async edit(
    autoModerationRule,
    { name, eventType, triggerMetadata, actions, enabled, exemptRoles, exemptChannels, reason },
  ) {
    const autoModerationRuleId = this.resolveId(autoModerationRule);
    const data = await this.client.api
      .guilds(this.guild.id)('auto-moderation')
      .rules(autoModerationRuleId)
      .patch({
        data: {
          name,
          event_type: typeof eventType === 'number' ? eventType : AutoModerationRuleEventTypes[eventType],
          trigger_metadata: triggerMetadata && {
            keyword_filter: triggerMetadata.keywordFilter,
            regex_patterns: triggerMetadata.regexPatterns,
            presets: triggerMetadata.presets?.map(preset =>
              typeof preset === 'number' ? preset : AutoModerationRuleKeywordPresetTypes[preset],
            ),
            allow_list: triggerMetadata.allowList,
            mention_total_limit: triggerMetadata.mentionTotalLimit,
            mention_raid_protection_enabled: triggerMetadata.mentionRaidProtectionEnabled,
          },
          actions: actions?.map(action => ({
            type: typeof action.type === 'number' ? action.type : AutoModerationActionTypes[action.type],
            metadata: {
              duration_seconds: action.metadata?.durationSeconds,
              channel_id: action.metadata?.channel && this.guild.channels.resolveId(action.metadata.channel),
              custom_message: action.metadata?.customMessage,
            },
          })),
          enabled,
          exempt_roles: exemptRoles?.map(exemptRole => this.guild.roles.resolveId(exemptRole)),
          exempt_channels: exemptChannels?.map(exemptChannel => this.guild.channels.resolveId(exemptChannel)),
        },
        reason,
      });
    return this._add(data);
  }
  fetch(options) {
    if (!options) return this._fetchMany();
    const { autoModerationRule, cache, force } = options;
    const resolvedAutoModerationRule = this.resolveId(autoModerationRule ?? options);
    if (resolvedAutoModerationRule) {
      return this._fetchSingle({ autoModerationRule: resolvedAutoModerationRule, cache, force });
    }
    return this._fetchMany(options);
  }
  async _fetchSingle({ autoModerationRule, cache, force = false }) {
    if (!force) {
      const existing = this.cache.get(autoModerationRule);
      if (existing) return existing;
    }
    const data = await this.client.api.guilds(this.guild.id)('auto-moderation').rules(autoModerationRule).get();
    return this._add(data, cache);
  }
  async _fetchMany(options = {}) {
    const data = await this.client.api.guilds(this.guild.id)('auto-moderation').rules.get();
    return data.reduce(
      (col, autoModerationRule) => col.set(autoModerationRule.id, this._add(autoModerationRule, options.cache)),
      new Collection(),
    );
  }
  async delete(autoModerationRule, reason) {
    const autoModerationRuleId = this.resolveId(autoModerationRule);
    await this.client.api.guilds(this.guild.id)('auto-moderation').rules(autoModerationRuleId).delete({ reason });
  }
}
module.exports = AutoModerationRuleManager;
