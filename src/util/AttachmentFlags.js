'use strict';
const BitField = require('./BitField');
class AttachmentFlags extends BitField {}
AttachmentFlags.FLAGS = {
  IS_REMIX: 1 << 2,
};
module.exports = AttachmentFlags;
