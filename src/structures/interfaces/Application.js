'use strict';
const process = require('node:process');
const { ApplicationFlags } = require('../../util/ApplicationFlags');
const { ClientApplicationAssetTypes, Endpoints } = require('../../util/Constants');
const Permissions = require('../../util/Permissions');
const SnowflakeUtil = require('../../util/SnowflakeUtil');
const { ApplicationRoleConnectionMetadata } = require('../ApplicationRoleConnectionMetadata');
const Base = require('../Base');
const Team = require('../Team');
const AssetTypes = Object.keys(ClientApplicationAssetTypes);
let deprecationEmittedForFetchAssets = false;
class Application extends Base {
  constructor(client, data) {
    super(client);
    this._patch(data);
  }
  _patch(data) {
    this.id = data.id;
    if ('name' in data) {
      this.name = data.name;
    } else {
      this.name ??= null;
    }
    if ('description' in data) {
      this.description = data.description;
    } else {
      this.description ??= null;
    }
    if ('icon' in data) {
      this.icon = data.icon;
    } else {
      this.icon ??= null;
    }
    if ('terms_of_service_url' in data) {
      this.termsOfServiceURL = data.terms_of_service_url;
    } else {
      this.termsOfServiceURL ??= null;
    }
    if ('privacy_policy_url' in data) {
      this.privacyPolicyURL = data.privacy_policy_url;
    } else {
      this.privacyPolicyURL ??= null;
    }
    if ('verify_key' in data) {
      this.verifyKey = data.verify_key;
    } else {
      this.verifyKey ??= null;
    }
    if ('role_connections_verification_url' in data) {
      this.roleConnectionsVerificationURL = data.role_connections_verification_url;
    } else {
      this.roleConnectionsVerificationURL ??= null;
    }
    this.tags = data.tags ?? [];
    if ('install_params' in data) {
      this.installParams = {
        scopes: data.install_params.scopes,
        permissions: new Permissions(data.install_params.permissions).freeze(),
      };
    } else {
      this.installParams ??= null;
    }
    if ('custom_install_url' in data) {
      this.customInstallURL = data.custom_install_url;
    } else {
      this.customInstallURL = null;
    }
    if ('flags' in data) {
      this.flags = new ApplicationFlags(data.flags).freeze();
    }
    if ('approximate_guild_count' in data) {
      this.approximateGuildCount = data.approximate_guild_count;
    } else {
      this.approximateGuildCount ??= null;
    }
    if ('guild_id' in data) {
      this.guildId = data.guild_id;
    } else {
      this.guildId ??= null;
    }
    if ('cover_image' in data) {
      this.cover = data.cover_image;
    } else {
      this.cover ??= null;
    }
    if ('rpc_origins' in data) {
      this.rpcOrigins = data.rpc_origins;
    } else {
      this.rpcOrigins ??= [];
    }
    if ('bot_require_code_grant' in data) {
      this.botRequireCodeGrant = data.bot_require_code_grant;
    } else {
      this.botRequireCodeGrant ??= null;
    }
    if ('bot_public' in data) {
      this.botPublic = data.bot_public;
    } else {
      this.botPublic ??= null;
    }
    this.owner = data.team
      ? new Team(this.client, data.team)
      : data.owner
        ? this.client.users._add(data.owner)
        : (this.owner ?? null);
  }
  get guild() {
    return this.client.guilds.cache.get(this.guildId) ?? null;
  }
  get partial() {
    return !this.name;
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  async fetch() {
    const app = await this.client.api.oauth2.authorize.get({
      query: {
        client_id: this.id,
        scope: 'bot applications.commands',
      },
    });
    const user = this.client.users._add(app.bot);
    user._partial = false;
    this._patch(app.application);
    return this;
  }
  async fetchRoleConnectionMetadataRecords() {
    const metadata = await this.client.api.applications(this.id)('role-connections').metadata.get();
    return metadata.map(data => new ApplicationRoleConnectionMetadata(data));
  }
  iconURL({ format, size } = {}) {
    if (!this.icon) return null;
    return this.client.rest.cdn.AppIcon(this.id, this.icon, { format, size });
  }
  coverURL({ format, size } = {}) {
    if (!this.cover) return null;
    return Endpoints.CDN(this.client.options.http.cdn).AppIcon(this.id, this.cover, { format, size });
  }
  async fetchAssets() {
    if (!deprecationEmittedForFetchAssets) {
      process.emitWarning(
        'Application#fetchAssets is deprecated as it is unsupported and will be removed in the next major version.',
        'DeprecationWarning',
      );
      deprecationEmittedForFetchAssets = true;
    }
    const assets = await this.client.api.oauth2.applications(this.id).assets.get();
    return assets.map(a => ({
      id: a.id,
      name: a.name,
      type: AssetTypes[a.type - 1],
    }));
  }
  toString() {
    return this.name;
  }
  toJSON() {
    return super.toJSON({ createdTimestamp: true });
  }
}
module.exports = Application;
