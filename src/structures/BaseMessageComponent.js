'use strict';
const { TypeError } = require('../errors');
const { MessageComponentTypes, Events } = require('../util/Constants');
class BaseMessageComponent {
  constructor(data) {
    this.type = 'type' in data ? BaseMessageComponent.resolveType(data.type) : null;
  }
  static create(data, client) {
    let component;
    let type = data.type;
    if (typeof type === 'string') type = MessageComponentTypes[type];
    switch (type) {
      case MessageComponentTypes.ACTION_ROW: {
        const MessageActionRow = require('./MessageActionRow');
        component = data instanceof MessageActionRow ? data : new MessageActionRow(data, client);
        break;
      }
      case MessageComponentTypes.BUTTON: {
        const MessageButton = require('./MessageButton');
        component = data instanceof MessageButton ? data : new MessageButton(data);
        break;
      }
      case MessageComponentTypes.STRING_SELECT:
      case MessageComponentTypes.USER_SELECT:
      case MessageComponentTypes.ROLE_SELECT:
      case MessageComponentTypes.MENTIONABLE_SELECT:
      case MessageComponentTypes.CHANNEL_SELECT: {
        const MessageSelectMenu = require('./MessageSelectMenu');
        component = data instanceof MessageSelectMenu ? data : new MessageSelectMenu(data);
        break;
      }
      case MessageComponentTypes.TEXT_INPUT: {
        const TextInputComponent = require('./TextInputComponent');
        component = data instanceof TextInputComponent ? data : new TextInputComponent(data);
        break;
      }
      default:
        if (client) {
          client.emit(Events.DEBUG, `[BaseMessageComponent] Received component with unknown type: ${data.type}`);
        } else {
          throw new TypeError('INVALID_TYPE', 'data.type', 'valid MessageComponentType');
        }
    }
    return component;
  }
  static resolveType(type) {
    return typeof type === 'string' ? type : MessageComponentTypes[type];
  }
}
module.exports = BaseMessageComponent;
