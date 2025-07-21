'use strict';
const Base = require('./Base');
const ApplicationCommandPermissionsManager = require('../managers/ApplicationCommandPermissionsManager');
const { ApplicationCommandOptionTypes, ApplicationCommandTypes, ChannelTypes } = require('../util/Constants');
const Permissions = require('../util/Permissions');
const SnowflakeUtil = require('../util/SnowflakeUtil');
class ApplicationCommand extends Base {
  constructor(client, data, guild, guildId) {
    super(client);
    this.id = data.id;
    this.applicationId = data.application_id;
    this.guild = guild ?? null;
    this.guildId = guild?.id ?? guildId ?? null;
    this.permissions = new ApplicationCommandPermissionsManager(this);
    this.type = ApplicationCommandTypes[data.type];
    this._patch(data);
  }
  _patch(data) {
    if ('name' in data) {
      this.name = data.name;
    }
    if ('name_localizations' in data) {
      this.nameLocalizations = data.name_localizations;
    } else {
      this.nameLocalizations ??= null;
    }
    if ('name_localized' in data) {
      this.nameLocalized = data.name_localized;
    } else {
      this.nameLocalized ??= null;
    }
    if ('description' in data) {
      this.description = data.description;
    }
    if ('description_localizations' in data) {
      this.descriptionLocalizations = data.description_localizations;
    } else {
      this.descriptionLocalizations ??= null;
    }
    if ('description_localized' in data) {
      this.descriptionLocalized = data.description_localized;
    } else {
      this.descriptionLocalized ??= null;
    }
    if ('options' in data) {
      this.options = data.options.map(o => this.constructor.transformOption(o, true));
    } else {
      this.options ??= [];
    }
    if ('default_permission' in data) {
      this.defaultPermission = data.default_permission;
    }
    if ('default_member_permissions' in data) {
      this.defaultMemberPermissions = data.default_member_permissions
        ? new Permissions(BigInt(data.default_member_permissions)).freeze()
        : null;
    } else {
      this.defaultMemberPermissions ??= null;
    }
    if ('dm_permission' in data) {
      this.dmPermission = data.dm_permission;
    } else {
      this.dmPermission ??= null;
    }
    if ('version' in data) {
      this.version = data.version;
    }
  }
  get createdTimestamp() {
    return SnowflakeUtil.timestampFrom(this.id);
  }
  get createdAt() {
    return new Date(this.createdTimestamp);
  }
  get manager() {
    return (this.guild ?? this.client.application).commands;
  }
  edit(data) {
    return this.manager.edit(this, data, this.guildId);
  }
  setName(name) {
    return this.edit({ name });
  }
  setNameLocalizations(nameLocalizations) {
    return this.edit({ nameLocalizations });
  }
  setDescription(description) {
    return this.edit({ description });
  }
  setDescriptionLocalizations(descriptionLocalizations) {
    return this.edit({ descriptionLocalizations });
  }
  setDefaultPermission(defaultPermission = true) {
    return this.edit({ defaultPermission });
  }
  setDefaultMemberPermissions(defaultMemberPermissions) {
    return this.edit({ defaultMemberPermissions });
  }
  setDMPermission(dmPermission = true) {
    return this.edit({ dmPermission });
  }
  setOptions(options) {
    return this.edit({ options });
  }
  delete() {
    return this.manager.delete(this, this.guildId);
  }
  equals(command, enforceOptionOrder = false) {
    if (command.id && this.id !== command.id) return false;
    let defaultMemberPermissions = null;
    let dmPermission = command.dmPermission ?? command.dm_permission;
    if ('default_member_permissions' in command) {
      defaultMemberPermissions = command.default_member_permissions
        ? new Permissions(BigInt(command.default_member_permissions)).bitfield
        : null;
    }
    if ('defaultMemberPermissions' in command) {
      defaultMemberPermissions =
        command.defaultMemberPermissions !== null ? new Permissions(command.defaultMemberPermissions).bitfield : null;
    }
    const commandType = typeof command.type === 'string' ? command.type : ApplicationCommandTypes[command.type];
    if (
      command.name !== this.name ||
      ('description' in command && command.description !== this.description) ||
      ('version' in command && command.version !== this.version) ||
      ('autocomplete' in command && command.autocomplete !== this.autocomplete) ||
      (commandType && commandType !== this.type) ||
      defaultMemberPermissions !== (this.defaultMemberPermissions?.bitfield ?? null) ||
      (typeof dmPermission !== 'undefined' && dmPermission !== this.dmPermission) ||
      (command.options?.length ?? 0) !== (this.options?.length ?? 0) ||
      (command.defaultPermission ?? command.default_permission ?? true) !== this.defaultPermission
    ) {
      return false;
    }
    if (command.options) {
      return this.constructor.optionsEqual(this.options, command.options, enforceOptionOrder);
    }
    return true;
  }
  static optionsEqual(existing, options, enforceOptionOrder = false) {
    if (existing.length !== options.length) return false;
    if (enforceOptionOrder) {
      return existing.every((option, index) => this._optionEquals(option, options[index], enforceOptionOrder));
    }
    const newOptions = new Map(options.map(option => [option.name, option]));
    for (const option of existing) {
      const foundOption = newOptions.get(option.name);
      if (!foundOption || !this._optionEquals(option, foundOption)) return false;
    }
    return true;
  }
  static _optionEquals(existing, option, enforceOptionOrder = false) {
    const optionType = typeof option.type === 'string' ? option.type : ApplicationCommandOptionTypes[option.type];
    if (
      option.name !== existing.name ||
      optionType !== existing.type ||
      option.description !== existing.description ||
      option.autocomplete !== existing.autocomplete ||
      (option.required ?? (['SUB_COMMAND', 'SUB_COMMAND_GROUP'].includes(optionType) ? undefined : false)) !==
        existing.required ||
      option.choices?.length !== existing.choices?.length ||
      option.options?.length !== existing.options?.length ||
      (option.channelTypes ?? option.channel_types)?.length !== existing.channelTypes?.length ||
      (option.minValue ?? option.min_value) !== existing.minValue ||
      (option.maxValue ?? option.max_value) !== existing.maxValue ||
      (option.minLength ?? option.min_length) !== existing.minLength ||
      (option.maxLength ?? option.max_length) !== existing.maxLength
    ) {
      return false;
    }
    if (existing.choices) {
      if (
        enforceOptionOrder &&
        !existing.choices.every(
          (choice, index) => choice.name === option.choices[index].name && choice.value === option.choices[index].value,
        )
      ) {
        return false;
      }
      if (!enforceOptionOrder) {
        const newChoices = new Map(option.choices.map(choice => [choice.name, choice]));
        for (const choice of existing.choices) {
          const foundChoice = newChoices.get(choice.name);
          if (!foundChoice || foundChoice.value !== choice.value) return false;
        }
      }
    }
    if (existing.channelTypes) {
      const newTypes = (option.channelTypes ?? option.channel_types).map(type =>
        typeof type === 'number' ? ChannelTypes[type] : type,
      );
      for (const type of existing.channelTypes) {
        if (!newTypes.includes(type)) return false;
      }
    }
    if (existing.options) {
      return this.optionsEqual(existing.options, option.options, enforceOptionOrder);
    }
    return true;
  }
  static transformOption(option, received) {
    const stringType = typeof option.type === 'string' ? option.type : ApplicationCommandOptionTypes[option.type];
    const channelTypesKey = received ? 'channelTypes' : 'channel_types';
    const minValueKey = received ? 'minValue' : 'min_value';
    const maxValueKey = received ? 'maxValue' : 'max_value';
    const minLengthKey = received ? 'minLength' : 'min_length';
    const maxLengthKey = received ? 'maxLength' : 'max_length';
    const nameLocalizationsKey = received ? 'nameLocalizations' : 'name_localizations';
    const nameLocalizedKey = received ? 'nameLocalized' : 'name_localized';
    const descriptionLocalizationsKey = received ? 'descriptionLocalizations' : 'description_localizations';
    const descriptionLocalizedKey = received ? 'descriptionLocalized' : 'description_localized';
    return {
      type: typeof option.type === 'number' && !received ? option.type : ApplicationCommandOptionTypes[option.type],
      name: option.name,
      [nameLocalizationsKey]: option.nameLocalizations ?? option.name_localizations,
      [nameLocalizedKey]: option.nameLocalized ?? option.name_localized,
      description: option.description,
      [descriptionLocalizationsKey]: option.descriptionLocalizations ?? option.description_localizations,
      [descriptionLocalizedKey]: option.descriptionLocalized ?? option.description_localized,
      required:
        option.required ?? (stringType === 'SUB_COMMAND' || stringType === 'SUB_COMMAND_GROUP' ? undefined : false),
      autocomplete: option.autocomplete,
      choices: option.choices?.map(choice => ({
        name: choice.name,
        [nameLocalizedKey]: choice.nameLocalized ?? choice.name_localized,
        [nameLocalizationsKey]: choice.nameLocalizations ?? choice.name_localizations,
        value: choice.value,
      })),
      options: option.options?.map(o => this.transformOption(o, received)),
      [channelTypesKey]: received
        ? option.channel_types?.map(type => ChannelTypes[type])
        : (option.channelTypes?.map(type => (typeof type === 'string' ? ChannelTypes[type] : type)) ??
          option.channel_types),
      [minValueKey]: option.minValue ?? option.min_value,
      [maxValueKey]: option.maxValue ?? option.max_value,
      [minLengthKey]: option.minLength ?? option.min_length,
      [maxLengthKey]: option.maxLength ?? option.max_length,
    };
  }
}
module.exports = ApplicationCommand;
