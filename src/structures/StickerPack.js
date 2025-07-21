'use strict';
const { Collection } = require('@discordjs/collection');
const Base = require('./Base');
const { Sticker } = require('./Sticker');
const SnowflakeUtil = require('../util/SnowflakeUtil');
class StickerPack extends Base {
  constructor(client, pack) {
    super(client);
    this.id = pack.id;
    this.stickers = new Collection(pack.stickers.map(s => [s.id, new Sticker(client, s)]));
    this.name = pack.name;
    this.skuId = pack.sku_id;
    this.coverStickerId = pack.cover_sticker_id ?? null;
    this.description = pack.description;
    this.bannerId = pack.banner_asset_id ?? null;
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  get coverSticker() {
    return this.coverStickerId && this.stickers.get(this.coverStickerId);
  }
  bannerURL({ format, size } = {}) {
    return this.bannerId && this.client.rest.cdn.StickerPackBanner(this.bannerId, format, size);
  }
}
module.exports = StickerPack;
