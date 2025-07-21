'use strict';
const ThreadManager = require('./ThreadManager');
const { TypeError } = require('../errors');
const { ChannelTypes } = require('../util/Constants');
const { resolveAutoArchiveMaxLimit } = require('../util/Util');
class GuildTextThreadManager extends ThreadManager {
  async create({
    name,
    autoArchiveDuration = this.channel.defaultAutoArchiveDuration,
    startMessage,
    type,
    invitable,
    reason,
    rateLimitPerUser,
  } = {}) {
    let path = this.client.api.channels(this.channel.id);
    if (type && typeof type !== 'string' && typeof type !== 'number') {
      throw new TypeError('INVALID_TYPE', 'type', 'ThreadChannelType or Number');
    }
    let resolvedType =
      this.channel.type === 'GUILD_NEWS' ? ChannelTypes.GUILD_NEWS_THREAD : ChannelTypes.GUILD_PUBLIC_THREAD;
    if (startMessage) {
      const startMessageId = this.channel.messages.resolveId(startMessage);
      if (!startMessageId) throw new TypeError('INVALID_TYPE', 'startMessage', 'MessageResolvable');
      path = path.messages(startMessageId);
    } else if (this.channel.type !== 'GUILD_NEWS') {
      resolvedType = typeof type === 'string' ? ChannelTypes[type] : (type ?? resolvedType);
    }
    if (autoArchiveDuration === 'MAX') autoArchiveDuration = resolveAutoArchiveMaxLimit(this.channel.guild);
    const data = await path.threads.post({
      data: {
        name,
        auto_archive_duration: autoArchiveDuration,
        type: resolvedType,
        invitable: resolvedType === ChannelTypes.GUILD_PRIVATE_THREAD ? invitable : undefined,
        rate_limit_per_user: rateLimitPerUser,
      },
      reason,
    });
    return this.client.actions.ThreadCreate.handle(data).thread;
  }
}
module.exports = GuildTextThreadManager;
