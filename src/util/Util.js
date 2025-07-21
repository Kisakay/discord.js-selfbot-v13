'use strict';
const { Agent } = require('node:http');
const { parse } = require('node:path');
const process = require('node:process');
const { setTimeout } = require('node:timers');
const { Collection } = require('@discordjs/collection');
const { fetch } = require('undici');
const { Colors, Events } = require('./Constants');
const { Error: DiscordError, RangeError, TypeError } = require('../errors');
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObject = d => typeof d === 'object' && d !== null;
let deprecationEmittedForSplitMessage = false;
let deprecationEmittedForRemoveMentions = false;
let deprecationEmittedForResolveAutoArchiveMaxLimit = false;
const TextSortableGroupTypes = ['GUILD_TEXT', 'GUILD_ANNOUCMENT', 'GUILD_FORUM'];
const VoiceSortableGroupTypes = ['GUILD_VOICE', 'GUILD_STAGE_VOICE'];
const CategorySortableGroupTypes = ['GUILD_CATEGORY'];
const payloadTypes = [
  {
    name: 'opus',
    type: 'audio',
    priority: 1000,
    payload_type: 120,
  },
  {
    name: 'AV1',
    type: 'video',
    priority: 1000,
    payload_type: 101,
    rtx_payload_type: 102,
    encode: false,
    decode: false,
  },
  {
    name: 'H265',
    type: 'video',
    priority: 2000,
    payload_type: 103,
    rtx_payload_type: 104,
    encode: false,
    decode: false,
  },
  {
    name: 'H264',
    type: 'video',
    priority: 3000,
    payload_type: 105,
    rtx_payload_type: 106,
    encode: true,
    decode: true,
  },
  {
    name: 'VP8',
    type: 'video',
    priority: 4000,
    payload_type: 107,
    rtx_payload_type: 108,
    encode: true,
    decode: false,
  },
  {
    name: 'VP9',
    type: 'video',
    priority: 5000,
    payload_type: 109,
    rtx_payload_type: 110,
    encode: false,
    decode: false,
  },
];
class Util extends null {
  static flatten(obj, ...props) {
    if (!isObject(obj)) return obj;
    const objProps = Object.keys(obj)
      .filter(k => !k.startsWith('_'))
      .map(k => ({ [k]: true }));
    props = objProps.length ? Object.assign(...objProps, ...props) : Object.assign({}, ...props);
    const out = {};
    for (let [prop, newProp] of Object.entries(props)) {
      if (!newProp) continue;
      newProp = newProp === true ? prop : newProp;
      const element = obj[prop];
      const elemIsObj = isObject(element);
      const valueOf = elemIsObj && typeof element.valueOf === 'function' ? element.valueOf() : null;
      const hasToJSON = elemIsObj && typeof element.toJSON === 'function';
      if (element instanceof Collection) out[newProp] = Array.from(element.keys());
      else if (valueOf instanceof Collection) out[newProp] = Array.from(valueOf.keys());
      else if (Array.isArray(element)) out[newProp] = element.map(e => e.toJSON?.() ?? Util.flatten(e));
      else if (typeof valueOf !== 'object') out[newProp] = valueOf;
      else if (hasToJSON) out[newProp] = element.toJSON();
      else if (typeof element === 'object') out[newProp] = Util.flatten(element);
      else if (!elemIsObj) out[newProp] = element;
    }
    return out;
  }
  static splitMessage(text, { maxLength = 2_000, char = '\n', prepend = '', append = '' } = {}) {
    if (!deprecationEmittedForSplitMessage) {
      process.emitWarning(
        'The Util.splitMessage method is deprecated and will be removed in the next major version.',
        'DeprecationWarning',
      );
      deprecationEmittedForSplitMessage = true;
    }
    text = Util.verifyString(text);
    if (text.length <= maxLength) return [text];
    let splitText = [text];
    if (Array.isArray(char)) {
      while (char.length > 0 && splitText.some(elem => elem.length > maxLength)) {
        const currentChar = char.shift();
        if (currentChar instanceof RegExp) {
          splitText = splitText.flatMap(chunk => chunk.match(currentChar));
        } else {
          splitText = splitText.flatMap(chunk => chunk.split(currentChar));
        }
      }
    } else {
      splitText = text.split(char);
    }
    if (splitText.some(elem => elem.length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');
    const messages = [];
    let msg = '';
    for (const chunk of splitText) {
      if (msg && (msg + char + chunk + append).length > maxLength) {
        messages.push(msg + append);
        msg = prepend;
      }
      msg += (msg && msg !== prepend ? char : '') + chunk;
    }
    return messages.concat(msg).filter(m => m);
  }
  static escapeMarkdown(
    text,
    {
      codeBlock = true,
      inlineCode = true,
      bold = true,
      italic = true,
      underline = true,
      strikethrough = true,
      spoiler = true,
      codeBlockContent = true,
      inlineCodeContent = true,
      escape = true,
      heading = false,
      bulletedList = false,
      numberedList = false,
      maskedLink = false,
    } = {},
  ) {
    if (!codeBlockContent) {
      return text
        .split('```')
        .map((subString, index, array) => {
          if (index % 2 && index !== array.length - 1) return subString;
          return Util.escapeMarkdown(subString, {
            inlineCode,
            bold,
            italic,
            underline,
            strikethrough,
            spoiler,
            inlineCodeContent,
            escape,
            heading,
            bulletedList,
            numberedList,
            maskedLink,
          });
        })
        .join(codeBlock ? '\\`\\`\\`' : '```');
    }
    if (!inlineCodeContent) {
      return text
        .split(/(?<=^|[^`])`(?=[^`]|$)/g)
        .map((subString, index, array) => {
          if (index % 2 && index !== array.length - 1) return subString;
          return Util.escapeMarkdown(subString, {
            codeBlock,
            bold,
            italic,
            underline,
            strikethrough,
            spoiler,
            escape,
            heading,
            bulletedList,
            numberedList,
            maskedLink,
          });
        })
        .join(inlineCode ? '\\`' : '`');
    }
    if (escape) text = Util.escapeEscape(text);
    if (inlineCode) text = Util.escapeInlineCode(text);
    if (codeBlock) text = Util.escapeCodeBlock(text);
    if (italic) text = Util.escapeItalic(text);
    if (bold) text = Util.escapeBold(text);
    if (underline) text = Util.escapeUnderline(text);
    if (strikethrough) text = Util.escapeStrikethrough(text);
    if (spoiler) text = Util.escapeSpoiler(text);
    if (heading) text = Util.escapeHeading(text);
    if (bulletedList) text = Util.escapeBulletedList(text);
    if (numberedList) text = Util.escapeNumberedList(text);
    if (maskedLink) text = Util.escapeMaskedLink(text);
    return text;
  }
  static escapeCodeBlock(text) {
    return text.replaceAll('```', '\\`\\`\\`');
  }
  static escapeInlineCode(text) {
    return text.replace(/(?<=^|[^`])``?(?=[^`]|$)/g, match => (match.length === 2 ? '\\`\\`' : '\\`'));
  }
  static escapeItalic(text) {
    let i = 0;
    text = text.replace(/(?<=^|[^*])\*([^*]|\*\*|$)/g, (_, match) => {
      if (match === '**') return ++i % 2 ? `\\*${match}` : `${match}\\*`;
      return `\\*${match}`;
    });
    i = 0;
    return text.replace(/(?<=^|[^_])_([^_]|__|$)/g, (_, match) => {
      if (match === '__') return ++i % 2 ? `\\_${match}` : `${match}\\_`;
      return `\\_${match}`;
    });
  }
  static escapeBold(text) {
    let i = 0;
    return text.replace(/\*\*(\*)?/g, (_, match) => {
      if (match) return ++i % 2 ? `${match}\\*\\*` : `\\*\\*${match}`;
      return '\\*\\*';
    });
  }
  static escapeUnderline(text) {
    let i = 0;
    return text.replace(/__(_)?/g, (_, match) => {
      if (match) return ++i % 2 ? `${match}\\_\\_` : `\\_\\_${match}`;
      return '\\_\\_';
    });
  }
  static escapeStrikethrough(text) {
    return text.replaceAll('~~', '\\~\\~');
  }
  static escapeSpoiler(text) {
    return text.replaceAll('||', '\\|\\|');
  }
  static escapeEscape(text) {
    return text.replaceAll('\\', '\\\\');
  }
  static escapeHeading(text) {
    return text.replaceAll(/^( {0,2}[*-] +)?(#{1,3} )/gm, '$1\\$2');
  }
  static escapeBulletedList(text) {
    return text.replaceAll(/^( *)[*-]( +)/gm, '$1\\-$2');
  }
  static escapeNumberedList(text) {
    return text.replaceAll(/^( *\d+)\./gm, '$1\\.');
  }
  static escapeMaskedLink(text) {
    return text.replaceAll(/\[.+\]\(.+\)/gm, '\\$&');
  }
  static fetchRecommendedShards() {
    throw new DiscordError('INVALID_USER_API');
  }
  static parseEmoji(text) {
    if (text.includes('%')) text = decodeURIComponent(text);
    if (!text.includes(':')) return { animated: false, name: text, id: null };
    const match = text.match(/<?(?:(a):)?(\w{2,32}):(\d{17,19})?>?/);
    return match && { animated: Boolean(match[1]), name: match[2], id: match[3] ?? null };
  }
  static resolvePartialEmoji(emoji) {
    if (!emoji) return null;
    if (typeof emoji === 'string') return /^\d{17,19}$/.test(emoji) ? { id: emoji } : Util.parseEmoji(emoji);
    const { id, name, animated } = emoji;
    if (!id && !name) return null;
    return { id, name, animated: Boolean(animated) };
  }
  static cloneObject(obj) {
    return Object.assign(Object.create(obj), obj);
  }
  static mergeDefault(def, given) {
    if (!given) return def;
    for (const key in def) {
      if (!has(given, key) || given[key] === undefined) {
        given[key] = def[key];
      } else if (given[key] === Object(given[key])) {
        given[key] = Util.mergeDefault(def[key], given[key]);
      }
    }
    return given;
  }
  static makeError(obj) {
    const err = new Error(obj.message);
    err.name = obj.name;
    err.stack = obj.stack;
    return err;
  }
  static makePlainError(err) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  static moveElementInArray(array, element, newIndex, offset = false) {
    const index = array.indexOf(element);
    newIndex = (offset ? index : 0) + newIndex;
    if (newIndex > -1 && newIndex < array.length) {
      const removedElement = array.splice(index, 1)[0];
      array.splice(newIndex, 0, removedElement);
    }
    return array.indexOf(element);
  }
  static verifyString(
    data,
    error = Error,
    errorMessage = `Expected a string, got ${data} instead.`,
    allowEmpty = true,
  ) {
    if (typeof data !== 'string') throw new error(errorMessage);
    if (!allowEmpty && data.length === 0) throw new error(errorMessage);
    return data;
  }
  static resolveColor(color) {
    if (typeof color === 'string') {
      if (color === 'RANDOM') return Math.floor(Math.random() * (0xffffff + 1));
      if (color === 'DEFAULT') return 0;
      color = Colors[color] ?? parseInt(color.replace('#', ''), 16);
    } else if (Array.isArray(color)) {
      color = (color[0] << 16) + (color[1] << 8) + color[2];
    }
    if (color < 0 || color > 0xffffff) throw new RangeError('COLOR_RANGE');
    else if (Number.isNaN(color)) throw new TypeError('COLOR_CONVERT');
    return color;
  }
  static discordSort(collection) {
    const isGuildChannel = collection.first() instanceof GuildChannel;
    return collection.sorted(
      isGuildChannel
        ? (a, b) => a.rawPosition - b.rawPosition || Number(BigInt(a.id) - BigInt(b.id))
        : (a, b) => a.rawPosition - b.rawPosition || Number(BigInt(b.id) - BigInt(a.id)),
    );
  }
  static async setPosition(item, position, relative, sorted, route, reason) {
    let updatedItems = [...sorted.values()];
    Util.moveElementInArray(updatedItems, item, position, relative);
    updatedItems = updatedItems.map((r, i) => ({ id: r.id, position: i }));
    await route.patch({ data: updatedItems, reason });
    return updatedItems;
  }
  static basename(path, ext) {
    const res = parse(path);
    return ext && res.ext.startsWith(ext) ? res.name : res.base.split('?')[0];
  }
  static removeMentions(str) {
    if (!deprecationEmittedForRemoveMentions) {
      process.emitWarning(
        'The Util.removeMentions method is deprecated. Use MessageOptions#allowedMentions instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForRemoveMentions = true;
    }
    return Util._removeMentions(str);
  }
  static _removeMentions(str) {
    return str.replaceAll('@', '@\u200b');
  }
  static cleanContent(str, channel) {
    str = str
      .replace(/<@!?[0-9]+>/g, input => {
        const id = input.replace(/<|!|>|@/g, '');
        if (channel.type === 'DM') {
          const user = channel.client.users.cache.get(id);
          return user ? Util._removeMentions(`@${user.username}`) : input;
        }
        const member = channel.guild?.members.cache.get(id);
        if (member) {
          return Util._removeMentions(`@${member.displayName}`);
        } else {
          const user = channel.client.users.cache.get(id);
          return user ? Util._removeMentions(`@${user.username}`) : input;
        }
      })
      .replace(/<#[0-9]+>/g, input => {
        const mentionedChannel = channel.client.channels.cache.get(input.replace(/<|#|>/g, ''));
        return mentionedChannel ? `#${mentionedChannel.name}` : input;
      })
      .replace(/<@&[0-9]+>/g, input => {
        if (channel.type === 'DM') return input;
        const role = channel.guild.roles.cache.get(input.replace(/<|@|>|&/g, ''));
        return role ? `@${role.name}` : input;
      });
    return str;
  }
  static cleanCodeBlockContent(text) {
    return text.replaceAll('```', '`\u200b``');
  }
  static archivedThreadSweepFilter(lifetime = 14400) {
    const filter = require('./Sweepers').archivedThreadSweepFilter(lifetime);
    filter.isDefault = true;
    return filter;
  }
  static resolveAutoArchiveMaxLimit() {
    if (!deprecationEmittedForResolveAutoArchiveMaxLimit) {
      process.emitWarning(
        "The Util.resolveAutoArchiveMaxLimit method and the 'MAX' option are deprecated and will be removed in the next major version.",
        'DeprecationWarning',
      );
      deprecationEmittedForResolveAutoArchiveMaxLimit = true;
    }
    return 10080;
  }
  static transformAPIGuildForumTag(tag) {
    return {
      id: tag.id,
      name: tag.name,
      moderated: tag.moderated,
      emoji:
        (tag.emoji_id ?? tag.emoji_name)
          ? {
              id: tag.emoji_id,
              name: tag.emoji_name,
            }
          : null,
    };
  }
  static transformGuildForumTag(tag) {
    return {
      id: tag.id,
      name: tag.name,
      moderated: tag.moderated,
      emoji_id: tag.emoji?.id ?? null,
      emoji_name: tag.emoji?.name ?? null,
    };
  }
  static transformAPIGuildDefaultReaction(defaultReaction) {
    return {
      id: defaultReaction.emoji_id,
      name: defaultReaction.emoji_name,
    };
  }
  static transformGuildDefaultReaction(defaultReaction) {
    return {
      emoji_id: defaultReaction.id,
      emoji_name: defaultReaction.name,
    };
  }
  static transformGuildScheduledEventRecurrenceRule(recurrenceRule) {
    return {
      start: new Date(recurrenceRule.startAt).toISOString(),
      frequency: recurrenceRule.frequency,
      interval: recurrenceRule.interval,
      by_weekday: recurrenceRule.byWeekday,
      by_n_weekday: recurrenceRule.byNWeekday,
      by_month: recurrenceRule.byMonth,
      by_month_day: recurrenceRule.byMonthDay,
    };
  }
  static transformAPIIncidentsData(data) {
    return {
      invitesDisabledUntil: data.invites_disabled_until ? new Date(data.invites_disabled_until) : null,
      dmsDisabledUntil: data.dms_disabled_until ? new Date(data.dms_disabled_until) : null,
      dmSpamDetectedAt: data.dm_spam_detected_at ? new Date(data.dm_spam_detected_at) : null,
      raidDetectedAt: data.raid_detected_at ? new Date(data.raid_detected_at) : null,
    };
  }
  static getSortableGroupTypes(type) {
    switch (type) {
      case 'GUILD_TEXT':
      case 'GUILD_ANNOUNCEMENT':
      case 'GUILD_FORUM':
        return TextSortableGroupTypes;
      case 'GUILD_VOICE':
      case 'GUILD_STAGE_VOICE':
        return VoiceSortableGroupTypes;
      case 'GUILD_CATEGORY':
        return CategorySortableGroupTypes;
      default:
        return [type];
    }
  }
  static calculateUserDefaultAvatarIndex(userId) {
    return Number(BigInt(userId) >> 22n) % 6;
  }
  static async getUploadURL(client, channelId, files) {
    if (!files.length) return [];
    files = files.map((file, i) => ({
      filename: file.name,
      file_size: Math.floor((26_214_400 / 10) * Math.random()),
      id: `${i}`,
    }));
    const { attachments } = await client.api.channels[channelId].attachments.post({
      data: {
        files,
      },
    });
    return attachments;
  }
  static uploadFile(data, url) {
    return new Promise((resolve, reject) => {
      fetch(url, {
        method: 'PUT',
        body: data,
        duplex: 'half', 
      })
        .then(res => {
          if (res.ok) {
            resolve(res);
          } else {
            reject(res);
          }
        })
        .catch(reject);
    });
  }
  static lazy(cb) {
    let defaultValue;
    return () => (defaultValue ??= cb());
  }
  static verifyProxyAgent(object) {
    return typeof object == 'object' && object.httpAgent instanceof Agent && object.httpsAgent instanceof Agent;
  }
  static checkUndiciProxyAgent(data) {
    if (typeof data === 'string') {
      return {
        uri: data,
      };
    }
    if (data instanceof URL) {
      return {
        uri: data.toString(),
      };
    }
    if (typeof data === 'object' && typeof data.uri === 'string') return data;
    return false;
  }
  static createPromiseInteraction(client, nonce, timeoutMs = 5_000, isHandlerDeferUpdate = false, parent) {
    return new Promise((resolve, reject) => {
      let dataFromInteractionSuccess;
      let dataFromNormalEvent;
      const handler = data => {
        if (isHandlerDeferUpdate && data.d?.nonce == nonce && data.t == 'INTERACTION_SUCCESS') {
          client.removeListener(Events.MESSAGE_CREATE, handler);
          client.removeListener(Events.UNHANDLED_PACKET, handler);
          client.removeListener(Events.INTERACTION_MODAL_CREATE, handler);
          dataFromInteractionSuccess = parent;
        }
        if (data.nonce !== nonce) return;
        clearTimeout(timeout);
        client.removeListener(Events.MESSAGE_CREATE, handler);
        client.removeListener(Events.INTERACTION_MODAL_CREATE, handler);
        if (isHandlerDeferUpdate) client.removeListener(Events.UNHANDLED_PACKET, handler);
        client.decrementMaxListeners();
        dataFromNormalEvent = data;
        resolve(data);
      };
      const timeout = setTimeout(() => {
        if (dataFromInteractionSuccess || dataFromNormalEvent) {
          resolve(dataFromNormalEvent || dataFromInteractionSuccess);
          return;
        }
        client.removeListener(Events.MESSAGE_CREATE, handler);
        client.removeListener(Events.INTERACTION_MODAL_CREATE, handler);
        if (isHandlerDeferUpdate) client.removeListener(Events.UNHANDLED_PACKET, handler);
        client.decrementMaxListeners();
        reject(new DiscordError('INTERACTION_FAILED'));
      }, timeoutMs).unref();
      client.incrementMaxListeners();
      client.on(Events.MESSAGE_CREATE, handler);
      client.on(Events.INTERACTION_MODAL_CREATE, handler);
      if (isHandlerDeferUpdate) client.on(Events.UNHANDLED_PACKET, handler);
    });
  }
  static clearNullOrUndefinedObject(object) {
    const data = {};
    const keys = Object.keys(object);
    for (const key of keys) {
      const value = object[key];
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        continue;
      } else if (!Array.isArray(value) && typeof value === 'object') {
        const cleanedValue = Util.clearNullOrUndefinedObject(value);
        if (cleanedValue !== undefined) {
          data[key] = cleanedValue;
        }
      } else {
        data[key] = value;
      }
    }
    return Object.keys(data).length > 0 ? data : undefined;
  }
  static getAllPayloadType() {
    return payloadTypes;
  }
  static getPayloadType(codecName) {
    return payloadTypes.find(p => p.name === codecName).payload_type;
  }
  static getSDPCodecName(portUdpH264, portUdpH265, portUdpOpus) {
    const payloadTypeH264 = Util.getPayloadType('H264');
    const payloadTypeH265 = Util.getPayloadType('H265');
    const payloadTypeOpus = Util.getPayloadType('opus');
    let sdpData = `v=0
o=- 0 0 IN IP4 0.0.0.0
s=-
c=IN IP4 0.0.0.0
t=0 0
a=tool:libavformat 61.1.100
m=video ${portUdpH264} RTP/AVP ${payloadTypeH264}
c=IN IP4 127.0.0.1
b=AS:1000
a=rtpmap:${payloadTypeH264} H264/90000
a=fmtp:${payloadTypeH264} profile-level-id=42e01f;sprop-parameter-sets=Z0IAH6tAoAt2AtwEBAaQeJEV,aM4JyA==;packetization-mode=1
${
  portUdpH265
    ? `m=video ${portUdpH265} RTP/AVP ${payloadTypeH265}
c=IN IP4 127.0.0.1
b=AS:1000
a=rtpmap:${payloadTypeH265} H265/90000`
    : ''
}
m=audio ${portUdpOpus} RTP/AVP ${payloadTypeOpus}
c=IN IP4 127.0.0.1
b=AS:96
a=rtpmap:${payloadTypeOpus} opus/48000/2
a=fmtp:${payloadTypeOpus} minptime=10;useinbandfec=1
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=extmap:2 http:
a=extmap:3 http:
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:5 http:
a=extmap:6 http:
a=extmap:7 http:
a=extmap:8 http:
a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=extmap:13 urn:3gpp:video-orientation
a=extmap:14 urn:ietf:params:rtp-hdrext:toffset
`;
    return sdpData;
  }
}
module.exports = Util;
const GuildChannel = require('../structures/GuildChannel');
