'use strict';
const CommandInteractionOptionResolver = require('./CommandInteractionOptionResolver');
const Interaction = require('./Interaction');
const { Error } = require('../errors');
const { InteractionResponseTypes, ApplicationCommandOptionTypes } = require('../util/Constants');
class AutocompleteInteraction extends Interaction {
  constructor(client, data) {
    super(client, data);
    this.commandId = data.data.id;
    this.commandName = data.data.name;
    this.responded = false;
    this.options = new CommandInteractionOptionResolver(
      this.client,
      data.data.options?.map(option => this.transformOption(option, data.data.resolved)) ?? [],
    );
  }
  get command() {
    const id = this.commandId;
    return this.guild?.commands.cache.get(id) ?? this.client.application.commands.cache.get(id) ?? null;
  }
  transformOption(option) {
    const result = {
      name: option.name,
      type: ApplicationCommandOptionTypes[option.type],
    };
    if ('value' in option) result.value = option.value;
    if ('options' in option) result.options = option.options.map(opt => this.transformOption(opt));
    if ('focused' in option) result.focused = option.focused;
    return result;
  }
  async respond(options) {
    if (this.responded) throw new Error('INTERACTION_ALREADY_REPLIED');
    await this.client.api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
        data: { choices: options.map(choice => ({ ...choice, name_localizations: options.nameLocalizations })) },
      },
      auth: false,
    });
    this.responded = true;
  }
}
module.exports = AutocompleteInteraction;
