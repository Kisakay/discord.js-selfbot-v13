'use strict';
const { Channel } = require('./Channel');
class DirectoryChannel extends Channel {
  _patch(data) {
    super._patch(data);
    this.name = data.name;
  }
}
module.exports = DirectoryChannel;
