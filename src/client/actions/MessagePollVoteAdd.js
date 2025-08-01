'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class MessagePollVoteAddAction extends Action {
  handle(data) {
    const channel = this.getChannel(data);
    if (!channel?.isText()) return false;
    const message = this.getMessage(data, channel);
    if (!message) return false;
    const { poll } = message;
    const answer = poll?.answers.get(data.answer_id);
    if (!answer) return false;
    answer.voteCount++;
    this.client.emit(Events.MESSAGE_POLL_VOTE_ADD, answer, data.user_id);
    return { poll };
  }
}
module.exports = MessagePollVoteAddAction;
