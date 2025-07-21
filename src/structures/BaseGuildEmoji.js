'use strict';
const { Emoji } = require('./Emoji');
class BaseGuildEmoji extends Emoji {
  constructor(client, data, guild) {
    super(client, data);
    this.guild = guild;
    this.requiresColons = null;
    this.managed = null;
    this.available = null;
    this._patch(data);
  }
  _patch(data) {
    if ('name' in data) this.name = data.name;
    if ('require_colons' in data) {
      this.requiresColons = data.require_colons;
    }
    if ('managed' in data) {
      this.managed = data.managed;
    }
    if ('available' in data) {
      this.available = data.available;
    }
  }
}
module.exports = BaseGuildEmoji;
