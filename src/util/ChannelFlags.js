'use strict';
const BitField = require('./BitField');
class ChannelFlags extends BitField {}
ChannelFlags.FLAGS = {
  PINNED: 1 << 1,
  REQUIRE_TAG: 1 << 4,
};
module.exports = ChannelFlags;
