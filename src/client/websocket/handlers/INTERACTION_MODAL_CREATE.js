'use strict';
const Modal = require('../../../structures/Modal');
const { Events } = require('../../../util/Constants');
module.exports = (client, { d: data }) => {
  client.emit(Events.INTERACTION_MODAL_CREATE, new Modal(data, client));
};
