'use strict';
const Action = require('./Action');
const { Events } = require('../../util/Constants');
const { PartialTypes } = require('../../util/Constants');
class PresenceUpdateAction extends Action {
  handle(data) {
    let user = this.client.users.cache.get(data.user.id);
    if (!user && data.user?.username) user = this.client.users._add(data.user);
    if (!user && ('username' in data.user || this.client.options.partials.includes(PartialTypes.USER))) {
      user = this.client.users._add(data.user);
    }
    if (!user) return;
    if (data.user?.username) {
      if (!user._equals(data.user)) this.client.actions.UserUpdate.handle(data.user);
    }
    const guild = this.client.guilds.cache.get(data.guild_id);
    if (guild) {
      let member = guild.members.cache.get(user.id);
      if (!member && data.status !== 'offline') {
        member = guild.members._add({
          user,
          deaf: false,
          mute: false,
        });
        this.client.emit(Events.GUILD_MEMBER_AVAILABLE, member);
      }
    }
    const oldPresence = (guild || this.client).presences.cache.get(user.id)?._clone() ?? null;
    const newPresence = (guild || this.client).presences._add(Object.assign(data, { guild }));
    if (this.client.listenerCount(Events.PRESENCE_UPDATE) && !newPresence.equals(oldPresence)) {
      this.client.emit(Events.PRESENCE_UPDATE, oldPresence, newPresence);
    }
  }
}
module.exports = PresenceUpdateAction;
