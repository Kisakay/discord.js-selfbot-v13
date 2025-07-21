'use strict';
const BitField = require('./BitField');
class InviteFlags extends BitField {}
InviteFlags.FLAGS = {
  GUEST: 1 << 0,
  VIEWED: 1 << 1,
};
module.exports = InviteFlags;
