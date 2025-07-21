'use strict';
const BitField = require('./BitField');
class Speaking extends BitField {}
Speaking.FLAGS = {
  SPEAKING: 1 << 0,
  SOUNDSHARE: 1 << 1,
  PRIORITY_SPEAKING: 1 << 2,
};
module.exports = Speaking;
