'use strict';
const { Emoji } = require('./Emoji');
const Util = require('../util/Util');
class ReactionEmoji extends Emoji {
  constructor(reaction, emoji) {
    super(reaction.message.client, emoji);
    this.reaction = reaction;
  }
  toJSON() {
    return Util.flatten(this, { identifier: true });
  }
  valueOf() {
    return this.id;
  }
}
module.exports = ReactionEmoji;
