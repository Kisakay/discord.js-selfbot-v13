'use strict';
const Base = require('./Base');
const SnowflakeUtil = require('../util/SnowflakeUtil');
class BaseGuild extends Base {
  constructor(client, data) {
    super(client);
    this.id = data.id;
    this.name = data.name;
    this.icon = data.icon;
    this.features = data.features;
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  get nameAcronym() {
    return this.name
      .replace(/'s /g, ' ')
      .replace(/\w+/g, e => e[0])
      .replace(/\s/g, '');
  }
  get partnered() {
    return this.features.includes('PARTNERED');
  }
  get verified() {
    return this.features.includes('VERIFIED');
  }
  iconURL({ format, size, dynamic } = {}) {
    if (!this.icon) return null;
    return this.client.rest.cdn.Icon(this.id, this.icon, format, size, dynamic);
  }
  async fetch() {
    const data = await this.client.api.guilds(this.id).get({ query: { with_counts: true } });
    return this.client.guilds._add(data);
  }
  toString() {
    return this.name;
  }
}
module.exports = BaseGuild;
