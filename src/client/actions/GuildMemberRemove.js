'use strict';
const Action = require('./Action');
const { deletedGuildMembers } = require('../../structures/GuildMember');
const { Events, Status } = require('../../util/Constants');
class GuildMemberRemoveAction extends Action {
  handle(data, shard) {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    let member = null;
    if (guild) {
      member = this.getMember({ user: data.user }, guild);
      guild.memberCount--;
      if (member) {
        deletedGuildMembers.add(member);
        guild.members.cache.delete(member.id);
        if (shard.status === Status.READY) client.emit(Events.GUILD_MEMBER_REMOVE, member);
      }
      guild.presences.cache.delete(data.user.id);
    }
    return { guild, member };
  }
}
module.exports = GuildMemberRemoveAction;
