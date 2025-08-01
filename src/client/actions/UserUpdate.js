'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
class UserUpdateAction extends Action {
  handle(data) {
    const client = this.client;
    const newUser = data.id === client.user.id ? client.user : client.users.cache.get(data.id);
    const oldUser = newUser._update(data);
    if (!oldUser.equals(newUser)) {
      client.emit(Events.USER_UPDATE, oldUser, newUser);
      return {
        old: oldUser,
        updated: newUser,
      };
    }
    return {
      old: null,
      updated: null,
    };
  }
}
module.exports = UserUpdateAction;
