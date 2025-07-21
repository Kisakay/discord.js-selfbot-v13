'use strict';
const Action = require('./Action');
const GuildAuditLogsEntry = require('../../structures/GuildAuditLogs').Entry;
const { Events } = require('../../util/Constants');
class GuildAuditLogEntryCreateAction extends Action {
  handle(data) {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    let auditLogEntry;
    if (guild) {
      auditLogEntry = new GuildAuditLogsEntry(guild, data);
      client.emit(Events.GUILD_AUDIT_LOG_ENTRY_CREATE, auditLogEntry, guild);
    }
    return { auditLogEntry };
  }
}
module.exports = GuildAuditLogEntryCreateAction;
