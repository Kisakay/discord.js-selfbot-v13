'use strict';
class ActionsManager {
  constructor(client) {
    this.client = client;
    this.injectedUser = Symbol('djs.actions.injectedUser');
    this.injectedChannel = Symbol('djs.actions.injectedChannel');
    this.injectedMessage = Symbol('djs.actions.injectedMessage');
    this.register(require('./ApplicationCommandPermissionsUpdate'));
    this.register(require('./AutoModerationActionExecution'));
    this.register(require('./AutoModerationRuleCreate'));
    this.register(require('./AutoModerationRuleDelete'));
    this.register(require('./AutoModerationRuleUpdate'));
    this.register(require('./ChannelCreate'));
    this.register(require('./ChannelDelete'));
    this.register(require('./ChannelUpdate'));
    this.register(require('./GuildAuditLogEntryCreate'));
    this.register(require('./GuildBanAdd'));
    this.register(require('./GuildBanRemove'));
    this.register(require('./GuildChannelsPositionUpdate'));
    this.register(require('./GuildDelete'));
    this.register(require('./GuildEmojiCreate'));
    this.register(require('./GuildEmojiDelete'));
    this.register(require('./GuildEmojiUpdate'));
    this.register(require('./GuildEmojisUpdate'));
    this.register(require('./GuildIntegrationsUpdate'));
    this.register(require('./GuildMemberRemove'));
    this.register(require('./GuildMemberUpdate'));
    this.register(require('./GuildRoleCreate'));
    this.register(require('./GuildRoleDelete'));
    this.register(require('./GuildRoleUpdate'));
    this.register(require('./GuildRolesPositionUpdate'));
    this.register(require('./GuildStickerCreate'));
    this.register(require('./GuildStickerDelete'));
    this.register(require('./GuildStickerUpdate'));
    this.register(require('./GuildStickersUpdate'));
    this.register(require('./GuildUpdate'));
    this.register(require('./InviteCreate'));
    this.register(require('./InviteDelete'));
    this.register(require('./MessageCreate'));
    this.register(require('./MessageDelete'));
    this.register(require('./MessageDeleteBulk'));
    this.register(require('./MessagePollVoteAdd'));
    this.register(require('./MessagePollVoteRemove'));
    this.register(require('./MessageReactionAdd'));
    this.register(require('./MessageReactionRemove'));
    this.register(require('./MessageReactionRemoveAll'));
    this.register(require('./MessageReactionRemoveEmoji'));
    this.register(require('./MessageUpdate'));
    this.register(require('./PresenceUpdate'));
    this.register(require('./UserUpdate'));
    this.register(require('./WebhooksUpdate'));
  }
  register(Action) {
    this[Action.name.replace(/Action$/, '')] = new Action(this.client);
  }
}
module.exports = ActionsManager;
