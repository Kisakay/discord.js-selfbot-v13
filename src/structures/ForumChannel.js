'use strict';
const ThreadOnlyChannel = require('./ThreadOnlyChannel');
const { ForumLayoutTypes } = require('../util/Constants');
class ForumChannel extends ThreadOnlyChannel {
  _patch(data) {
    super._patch(data);
    this.defaultForumLayout = ForumLayoutTypes[data.default_forum_layout];
  }
  setDefaultForumLayout(defaultForumLayout, reason) {
    return this.edit({ defaultForumLayout }, reason);
  }
}
module.exports = ForumChannel;
