'use strict';
const BitField = require('./BitField');
class PremiumUsageFlags extends BitField {}
PremiumUsageFlags.FLAGS = {
  PREMIUM_DISCRIMINATOR: 1 << 0,
  ANIMATED_AVATAR: 1 << 1,
  PROFILE_BANNER: 1 << 2,
};
module.exports = PremiumUsageFlags;
