'use strict';
const BaseGuild = require('./BaseGuild');
const Permissions = require('../util/Permissions');
class OAuth2Guild extends BaseGuild {
  constructor(client, data) {
    super(client, data);
    this.owner = data.owner;
    this.permissions = new Permissions(BigInt(data.permissions)).freeze();
  }
}
module.exports = OAuth2Guild;
