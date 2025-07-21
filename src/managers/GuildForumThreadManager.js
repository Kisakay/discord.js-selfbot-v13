'use strict';
const ThreadManager = require('./ThreadManager');
const { TypeError } = require('../errors');
const MessagePayload = require('../structures/MessagePayload');
const { resolveAutoArchiveMaxLimit, getUploadURL, uploadFile } = require('../util/Util');
class GuildForumThreadManager extends ThreadManager {
  async create({
    name,
    autoArchiveDuration = this.channel.defaultAutoArchiveDuration,
    message,
    reason,
    rateLimitPerUser,
    appliedTags,
  } = {}) {
    if (!message) {
      throw new TypeError('GUILD_FORUM_MESSAGE_REQUIRED');
    }
    let messagePayload;
    if (message instanceof MessagePayload) {
      messagePayload = message.resolveData();
    } else {
      messagePayload = MessagePayload.create(this, message).resolveData();
    }
    const { data: body, files } = await messagePayload.resolveFiles();
    const attachments = await getUploadURL(this.client, this.channel.id, files);
    const requestPromises = attachments.map(async attachment => {
      await uploadFile(files[attachment.id].file, attachment.upload_url);
      return {
        id: attachment.id,
        filename: files[attachment.id].name,
        uploaded_filename: attachment.upload_filename,
        description: files[attachment.id].description,
        duration_secs: files[attachment.id].duration_secs,
        waveform: files[attachment.id].waveform,
      };
    });
    const attachmentsData = await Promise.all(requestPromises);
    attachmentsData.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    if (autoArchiveDuration === 'MAX') autoArchiveDuration = resolveAutoArchiveMaxLimit(this.channel.guild);
    const post_data = await this.client.api.channels(this.channel.id).threads.post({
      data: {
        name,
        auto_archive_duration: autoArchiveDuration,
        rate_limit_per_user: rateLimitPerUser,
        applied_tags: appliedTags,
        message: body,
        attachments: attachmentsData,
      },
      files: [],
      reason,
    });
    return this.client.actions.ThreadCreate.handle(post_data).thread;
  }
}
module.exports = GuildForumThreadManager;
