'use strict';
const ContextMenuInteraction = require('./ContextMenuInteraction');
class MessageContextMenuInteraction extends ContextMenuInteraction {
  get targetMessage() {
    return this.options.getMessage('message');
  }
}
module.exports = MessageContextMenuInteraction;
