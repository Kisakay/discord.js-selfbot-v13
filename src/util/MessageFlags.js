'use strict';
const BitField = require('./BitField');
class MessageFlags extends BitField {}
MessageFlags.FLAGS = {
  CROSSPOSTED: 1 << 0,
  IS_CROSSPOST: 1 << 1,
  SUPPRESS_EMBEDS: 1 << 2,
  SOURCE_MESSAGE_DELETED: 1 << 3,
  URGENT: 1 << 4,
  HAS_THREAD: 1 << 5,
  EPHEMERAL: 1 << 6,
  LOADING: 1 << 7,
  FAILED_TO_MENTION_SOME_ROLES_IN_THREAD: 1 << 8,
  GUILD_FEED_HIDDEN: 1 << 9,
  SHOULD_SHOW_LINK_NOT_DISCORD_WARNING: 1 << 10,
  SUPPRESS_NOTIFICATIONS: 1 << 12,
  IS_VOICE_MESSAGE: 1 << 13,
  HAS_SNAPSHOT: 1 << 14,
  IS_UIKIT_COMPONENTS: 1 << 15,
};
module.exports = MessageFlags;
