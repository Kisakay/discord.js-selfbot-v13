'use strict';
const GuildChannel = require('./GuildChannel');
class CategoryChannel extends GuildChannel {
  get children() {
    return this.guild.channels.cache.filter(c => c.parentId === this.id);
  }
  createChannel(name, options) {
    return this.guild.channels.create(name, {
      ...options,
      parent: this.id,
    });
  }
}
module.exports = CategoryChannel;
