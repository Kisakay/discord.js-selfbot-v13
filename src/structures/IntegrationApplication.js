'use strict';
const Application = require('./interfaces/Application');
class IntegrationApplication extends Application {
  _patch(data) {
    super._patch(data);
    if ('bot' in data) {
      this.bot = this.client.users._add(data.bot);
    } else {
      this.bot ??= null;
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
    if ('rpc_origins' in data) {
      this.rpcOrigins = data.rpc_origins;
    } else {
      this.rpcOrigins ??= [];
    }
    if ('summary' in data) {
      this.summary = data.summary;
    } else {
      this.summary ??= null;
    }
    if ('hook' in data) {
      this.hook = data.hook;
    } else {
      this.hook ??= null;
    }
    if ('cover_image' in data) {
      this.cover = data.cover_image;
    } else {
      this.cover ??= null;
    }
    if ('verify_key' in data) {
      this.verifyKey = data.verify_key;
    } else {
      this.verifyKey ??= null;
    }
  }
}
module.exports = IntegrationApplication;
