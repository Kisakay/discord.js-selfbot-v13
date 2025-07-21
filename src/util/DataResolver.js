'use strict';
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const stream = require('node:stream');
const { fetch } = require('undici');
const { Error: DiscordError, TypeError } = require('../errors');
const Invite = require('../structures/Invite');
class DataResolver extends null {
  static resolveCode(data, regex) {
    return new RegExp(regex.source).exec(data)?.[1] ?? data;
  }
  static resolveInviteCode(data) {
    return this.resolveCode(data, Invite.INVITES_PATTERN);
  }
  static resolveGuildTemplateCode(data) {
    const GuildTemplate = require('../structures/GuildTemplate');
    return this.resolveCode(data, GuildTemplate.GUILD_TEMPLATES_PATTERN);
  }
  static async resolveImage(image) {
    if (!image) return null;
    if (typeof image === 'string' && image.startsWith('data:')) {
      return image;
    }
    const file = await this.resolveFileAsBuffer(image);
    return DataResolver.resolveBase64(file);
  }
  static resolveBase64(data) {
    if (Buffer.isBuffer(data)) return `data:image/jpg;base64,${data.toString('base64')}`;
    return data;
  }
  static async resolveFile(resource) {
    if (Buffer.isBuffer(resource) || resource instanceof stream.Readable) return resource;
    if (typeof resource === 'string') {
      if (/^https?:\/\
        const res = await fetch(resource);
        if (res.ok) return res.body;
        else throw new DiscordError('FILE_NOT_FOUND', resource);
      }
      return new Promise((resolve, reject) => {
        const file = path.resolve(resource);
        fs.stat(file, (err, stats) => {
          if (err) return reject(err);
          if (!stats.isFile()) return reject(new DiscordError('FILE_NOT_FOUND', file));
          return resolve(fs.createReadStream(file));
        });
      });
    }
    throw new TypeError('REQ_RESOURCE_TYPE');
  }
  static async resolveFileAsBuffer(resource) {
    const file = await this.resolveFile(resource);
    if (Buffer.isBuffer(file)) return file;
    const buffers = [];
    for await (const data of file) buffers.push(data);
    return Buffer.concat(buffers);
  }
}
module.exports = DataResolver;
