'use strict';
const BitField = require('./BitField');
class PurchasedFlags extends BitField {}
PurchasedFlags.FLAGS = {
  NITRO_CLASSIC: 1 << 0,
  NITRO: 1 << 1,
  GUILD_BOOST: 1 << 2,
  NITRO_BASIC: 1 << 3,
};
module.exports = PurchasedFlags;
