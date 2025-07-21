'use strict';
const Base = require('./Base');
const { Emoji } = require('./Emoji');
class PollAnswer extends Base {
  constructor(client, data, poll) {
    super(client);
    Object.defineProperty(this, 'poll', { value: poll });
    this.id = data.answer_id;
    this.text = data.poll_media.text ?? null;
    Object.defineProperty(this, '_emoji', { value: data.poll_media.emoji ?? null });
    this._patch(data);
  }
  _patch(data) {
    if ('count' in data) {
      this.voteCount = data.count;
    } else {
      this.voteCount ??= 0;
    }
  }
  get emoji() {
    if (!this._emoji || (!this._emoji.id && !this._emoji.name)) return null;
    return this.client.emojis.cache.get(this._emoji.id) ?? new Emoji(this.client, this._emoji);
  }
  fetchVoters({ after, limit } = {}) {
    return this.poll.message.channel.messages.fetchPollAnswerVoters({
      messageId: this.poll.message.id,
      answerId: this.id,
      after,
      limit,
    });
  }
}
module.exports = { PollAnswer };
