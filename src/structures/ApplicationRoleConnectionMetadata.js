'use strict';
const { ApplicationRoleConnectionMetadataTypes } = require('../util/Constants');
class ApplicationRoleConnectionMetadata {
  constructor(data) {
    this.name = data.name;
    this.nameLocalizations = data.name_localizations ?? null;
    this.description = data.description;
    this.descriptionLocalizations = data.description_localizations ?? null;
    this.key = data.key;
    this.type = typeof data.type === 'number' ? ApplicationRoleConnectionMetadataTypes[data.type] : data.type;
  }
}
exports.ApplicationRoleConnectionMetadata = ApplicationRoleConnectionMetadata;
