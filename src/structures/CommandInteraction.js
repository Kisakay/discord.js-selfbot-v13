'use strict';
const BaseCommandInteraction = require('./BaseCommandInteraction');
const CommandInteractionOptionResolver = require('./CommandInteractionOptionResolver');
class CommandInteraction extends BaseCommandInteraction {
  constructor(client, data) {
    super(client, data);
    this.options = new CommandInteractionOptionResolver(
      this.client,
      data.data.options?.map(option => this.transformOption(option, data.data.resolved)) ?? [],
      this.transformResolved(data.data.resolved ?? {}),
    );
  }
  toString() {
    const properties = [
      this.commandName,
      this.options._group,
      this.options._subcommand,
      ...this.options._hoistedOptions.map(o => `${o.name}:${o.value}`),
    ];
    return `/${properties.filter(Boolean).join(' ')}`;
  }
}
module.exports = CommandInteraction;
