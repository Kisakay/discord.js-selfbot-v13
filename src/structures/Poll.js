'use strict';
const { Collection } = require('@discordjs/collection');
const Base = require('./Base');
const { PollAnswer } = require('./PollAnswer');
const { Error } = require('../errors');
const { PollLayoutTypes } = require('../util/Constants');
class Poll extends Base {
  constructor(client, data, message) {
    super(client);
    Object.defineProperty(this, 'message', { value: message });
    this.question = {
      text: data.question.text,
    };
    this.answers = data.answers.reduce(
      (acc, answer) => acc.set(answer.answer_id, new PollAnswer(this.client, answer, this)),
      new Collection(),
    );
    this.expiresTimestamp = Date.parse(data.expiry);
    this.allowMultiselect = data.allow_multiselect;
    this.layoutType = PollLayoutTypes[data.layout_type];
    this._patch(data);
  }
  _patch(data) {
    if (data.results) {
      this.resultsFinalized = data.results.is_finalized;
      for (const answerResult of data.results.answer_counts) {
        const answer = this.answers.get(answerResult.id);
        answer?._patch(answerResult);
      }
    } else {
      this.resultsFinalized ??= false;
    }
  }
  get expiresAt() {
    return new Date(this.expiresTimestamp);
  }
  async end() {
    if (Date.now() > this.expiresTimestamp) {
      throw new Error('POLL_ALREADY_EXPIRED');
    }
    return this.message.channel.messages.endPoll(this.message.id);
  }
}
module.exports = { Poll };
