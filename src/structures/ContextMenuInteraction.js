'use strict';
const BaseCommandInteraction = require('./BaseCommandInteraction');
const CommandInteractionOptionResolver = require('./CommandInteractionOptionResolver');
const { ApplicationCommandOptionTypes, ApplicationCommandTypes } = require('../util/Constants');
class ContextMenuInteraction extends BaseCommandInteraction {
  constructor(client, data) {
    super(client, data);
    this.options = new CommandInteractionOptionResolver(
      this.client,
      this.resolveContextMenuOptions(data.data),
      this.transformResolved(data.data.resolved),
    );
    this.targetId = data.data.target_id;
    this.targetType = ApplicationCommandTypes[data.data.type];
  }
  resolveContextMenuOptions({ target_id, resolved }) {
    const result = [];
    if (resolved.users?.[target_id]) {
      result.push(
        this.transformOption({ name: 'user', type: ApplicationCommandOptionTypes.USER, value: target_id }, resolved),
      );
    }
    if (resolved.messages?.[target_id]) {
      result.push({
        name: 'message',
        type: '_MESSAGE',
        value: target_id,
        message: this.channel?.messages._add(resolved.messages[target_id]) ?? resolved.messages[target_id],
      });
    }
    return result;
  }
}
module.exports = ContextMenuInteraction;
