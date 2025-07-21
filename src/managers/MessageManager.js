'use strict';
const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { TypeError } = require('../errors');
const { Message } = require('../structures/Message');
const MessagePayload = require('../structures/MessagePayload');
const Util = require('../util/Util');
class MessageManager extends CachedManager {
  constructor(channel, iterable) {
    super(channel.client, Message, iterable);
    this.channel = channel;
  }
  _add(data, cache) {
    return super._add(data, cache);
  }
  fetch(message, { cache = true, force = false } = {}) {
    return typeof message === 'string' ? this._fetchId(message, cache, force) : this._fetchMany(message, cache);
  }
  async fetchPinned(cache = true) {
    const data = await this.client.api.channels[this.channel.id].pins.get();
    const messages = new Collection();
    for (const message of data) messages.set(message.id, this._add(message, cache));
    return messages;
  }
  async edit(message, options) {
    const messageId = this.resolveId(message);
    if (!messageId) throw new TypeError('INVALID_TYPE', 'message', 'MessageResolvable');
    const { data, files } = await (
      options instanceof MessagePayload
        ? options
        : MessagePayload.create(message instanceof Message ? message : this, options)
    )
      .resolveData()
      .resolveFiles();
    const attachments = await Util.getUploadURL(this.client, this.channel.id, files);
    const requestPromises = attachments.map(async attachment => {
      await Util.uploadFile(files[attachment.id].file, attachment.upload_url);
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
    data.attachments = attachmentsData;
    const d = await this.client.api.channels[this.channel.id].messages[messageId].patch({ data });
    const existing = this.cache.get(messageId);
    if (existing) {
      const clone = existing._clone();
      clone._patch(d);
      return clone;
    }
    return this._add(d);
  }
  async crosspost(message) {
    message = this.resolveId(message);
    if (!message) throw new TypeError('INVALID_TYPE', 'message', 'MessageResolvable');
    const data = await this.client.api.channels(this.channel.id).messages(message).crosspost.post();
    return this.cache.get(data.id) ?? this._add(data);
  }
  async pin(message, reason) {
    message = this.resolveId(message);
    if (!message) throw new TypeError('INVALID_TYPE', 'message', 'MessageResolvable');
    await this.client.api.channels(this.channel.id).pins(message).put({ reason });
  }
  async unpin(message, reason) {
    message = this.resolveId(message);
    if (!message) throw new TypeError('INVALID_TYPE', 'message', 'MessageResolvable');
    await this.client.api.channels(this.channel.id).pins(message).delete({ reason });
  }
  async react(message, emoji, burst = false) {
    message = this.resolveId(message);
    if (!message) throw new TypeError('INVALID_TYPE', 'message', 'MessageResolvable');
    emoji = Util.resolvePartialEmoji(emoji);
    if (!emoji) throw new TypeError('EMOJI_TYPE', 'emoji', 'EmojiIdentifierResolvable');
    const emojiId = emoji.id
      ? `${emoji.animated ? 'a:' : ''}${emoji.name}:${emoji.id}`
      : encodeURIComponent(emoji.name);
    await this.client.api
      .channels(this.channel.id)
      .messages(message)
      .reactions(emojiId, '@me')
      .put({
        query: {
          type: burst ? 1 : 0,
        },
      });
  }
  async delete(message) {
    message = this.resolveId(message);
    if (!message) throw new TypeError('INVALID_TYPE', 'message', 'MessageResolvable');
    await this.client.api.channels(this.channel.id).messages(message).delete();
  }
  _fetchId(messageId, cache, force) {
    if (!force) {
      const existing = this.cache.get(messageId);
      if (existing && !existing.partial) return existing;
    }
    return new Promise((resolve, reject) => {
      this._fetchMany(
        {
          around: messageId,
          limit: 50,
        },
        cache,
      )
        .then(data_ =>
          data_.has(messageId) ? resolve(data_.get(messageId)) : reject(new Error('MESSAGE_ID_NOT_FOUND')),
        )
        .catch(reject);
    });
  }
  async search(options = {}) {
    let { authors, content, mentions, has, maxId, minId, channels, pinned, nsfw, offset, limit, sortBy, sortOrder } =
      Object.assign(
        {
          authors: [],
          content: '',
          mentions: [],
          has: [],
          maxId: null,
          minId: null,
          channels: [],
          pinned: false,
          nsfw: false,
          offset: 0,
          limit: 25,
          sortBy: 'timestamp',
          sortOrder: 'desc',
        },
        options,
      );
    if (authors.length > 0) authors = authors.map(u => this.client.users.resolveId(u));
    if (mentions.length > 0) mentions = mentions.map(u => this.client.users.resolveId(u));
    if (channels.length > 0) {
      channels = channels
        .map(c => this.client.channels.resolveId(c))
        .filter(id => {
          if (this.channel.guildId) {
            const c = this.channel.guild.channels.cache.get(id);
            if (!c || !c.messages) return false;
            const perm = c.permissionsFor(this.client.user);
            if (!perm.has('READ_MESSAGE_HISTORY') || !perm.has('VIEW_CHANNEL')) return false;
            return true;
          } else {
            return true;
          }
        });
    }
    if (limit && limit > 25) throw new RangeError('MESSAGE_SEARCH_LIMIT');
    let stringQuery = [];
    const result = new Collection();
    let data;
    if (authors.length > 0) stringQuery.push(authors.map(id => `author_id=${id}`).join('&'));
    if (content && content.length) stringQuery.push(`content=${encodeURIComponent(content)}`);
    if (mentions.length > 0) stringQuery.push(mentions.map(id => `mentions=${id}`).join('&'));
    has = has.filter(v => ['link', 'embed', 'file', 'video', 'image', 'sound', 'sticker'].includes(v));
    if (has.length > 0) stringQuery.push(has.map(v => `has=${v}`).join('&'));
    if (maxId) stringQuery.push(`max_id=${maxId}`);
    if (minId) stringQuery.push(`min_id=${minId}`);
    if (nsfw) stringQuery.push('include_nsfw=true');
    if (offset !== 0) stringQuery.push(`offset=${offset}`);
    if (limit !== 25) stringQuery.push(`limit=${limit}`);
    if (['timestamp', 'relevance'].includes(options.sortBy)) {
      stringQuery.push(`sort_by=${options.sortBy}`);
    } else {
      stringQuery.push('sort_by=timestamp');
    }
    if (['asc', 'desc'].includes(options.sortOrder)) {
      stringQuery.push(`sort_order=${options.sortOrder}`);
    } else {
      stringQuery.push('sort_order=desc');
    }
    if (this.channel.guildId && channels.length > 0) {
      stringQuery.push(channels.map(id => `channel_id=${id}`).join('&'));
    }
    if (typeof pinned == 'boolean') stringQuery.push(`pinned=${pinned}`);
    if (!stringQuery.length) {
      return {
        messages: result,
        total: 0,
      };
    }
    if (this.channel.guildId) {
      data = await this.client.api.guilds[this.channel.guildId].messages[`search?${stringQuery.join('&')}`].get();
    } else {
      stringQuery = stringQuery.filter(v => !v.startsWith('channel_id') && !v.startsWith('include_nsfw'));
      data = await this.client.api.channels[this.channel.id].messages[`search?${stringQuery.join('&')}`].get();
    }
    for await (const message of data.messages) result.set(message[0].id, new Message(this.client, message[0]));
    return {
      messages: result,
      total: data.total_results,
    };
  }
  async _fetchMany(options = {}, cache) {
    const data = await this.client.api.channels[this.channel.id].messages.get({ query: options });
    const messages = new Collection();
    for (const message of data) messages.set(message.id, this._add(message, cache));
    return messages;
  }
  async endPoll(messageId) {
    const message = await this.client.api.channels(this.channel.id).polls(messageId).expire.post();
    return this._add(message, false);
  }
  async fetchPollAnswerVoters({ messageId, answerId, after, limit }) {
    const voters = await this.client.channels(this.channel.id).polls(messageId).answers(answerId).get({
      query: { limit, after },
    });
    return voters.users.reduce((acc, user) => acc.set(user.id, this.client.users._add(user, false)), new Collection());
  }
}
module.exports = MessageManager;
