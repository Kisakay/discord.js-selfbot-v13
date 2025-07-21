'use strict';
const BitField = require('./BitField');
class RoleFlags extends BitField {}
RoleFlags.FLAGS = {
  IN_PROMPT: 1 << 0,
};
module.exports = RoleFlags;
