'use strict';
const EPOCH = 1_420_070_400_000;
let INCREMENT = BigInt(0);
class SnowflakeUtil extends null {
  static generate(timestamp = Date.now()) {
    if (timestamp instanceof Date) timestamp = timestamp.getTime();
    if (typeof timestamp !== 'number' || isNaN(timestamp)) {
      throw new TypeError(
        `"timestamp" argument must be a number (received ${isNaN(timestamp) ? 'NaN' : typeof timestamp})`,
      );
    }
    if (INCREMENT >= 4095n) INCREMENT = BigInt(0);
    return ((BigInt(timestamp - EPOCH) << 22n) | (1n << 17n) | INCREMENT++).toString();
  }
  static deconstruct(snowflake) {
    const bigIntSnowflake = BigInt(snowflake);
    return {
      timestamp: Number(bigIntSnowflake >> 22n) + EPOCH,
      get date() {
        return new Date(this.timestamp);
      },
      workerId: Number((bigIntSnowflake >> 17n) & 0b11111n),
      processId: Number((bigIntSnowflake >> 12n) & 0b11111n),
      increment: Number(bigIntSnowflake & 0b111111111111n),
      binary: bigIntSnowflake.toString(2).padStart(64, '0'),
    };
  }
  static timestampFrom(snowflake) {
    return Number(BigInt(snowflake) >> 22n) + EPOCH;
  }
  static get EPOCH() {
    return EPOCH;
  }
}
module.exports = SnowflakeUtil;
