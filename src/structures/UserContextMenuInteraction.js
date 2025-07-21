'use strict';
const ContextMenuInteraction = require('./ContextMenuInteraction');
class UserContextMenuInteraction extends ContextMenuInteraction {
  get targetUser() {
    return this.options.getUser('user');
  }
  get targetMember() {
    return this.options.getMember('user');
  }
}
module.exports = UserContextMenuInteraction;
