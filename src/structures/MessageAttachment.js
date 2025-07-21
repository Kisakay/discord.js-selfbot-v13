'use strict';
const AttachmentFlags = require('../util/AttachmentFlags');
const Util = require('../util/Util');
class MessageAttachment {
  constructor(attachment, name = null, data) {
    this.attachment = attachment;
    this.name = name;
    if (data) this._patch(data);
  }
  setDescription(description) {
    this.description = description;
    return this;
  }
  setFile(attachment, name = null) {
    this.attachment = attachment;
    this.name = name;
    return this;
  }
  setName(name) {
    this.name = name;
    return this;
  }
  setSpoiler(spoiler = true) {
    if (spoiler === this.spoiler) return this;
    if (!spoiler) {
      while (this.spoiler) {
        this.name = this.name.slice('SPOILER_'.length);
      }
      return this;
    }
    this.name = `SPOILER_${this.name}`;
    return this;
  }
  _patch(data) {
    this.id = data.id;
    if ('size' in data) {
      this.size = data.size;
    }
    if ('url' in data) {
      this.url = data.url;
    }
    if ('proxy_url' in data) {
      this.proxyURL = data.proxy_url;
    }
    if ('height' in data) {
      this.height = data.height;
    } else {
      this.height ??= null;
    }
    if ('width' in data) {
      this.width = data.width;
    } else {
      this.width ??= null;
    }
    if ('content_type' in data) {
      this.contentType = data.content_type;
    } else {
      this.contentType ??= null;
    }
    if ('description' in data) {
      this.description = data.description;
    } else {
      this.description ??= null;
    }
    this.ephemeral = data.ephemeral ?? false;
    if ('duration_secs' in data) {
      this.duration = data.duration_secs;
    } else {
      this.duration ??= null;
    }
    if ('waveform' in data) {
      this.waveform = data.waveform;
    } else {
      this.waveform ??= null;
    }
    if ('flags' in data) {
      this.flags = new AttachmentFlags(data.flags).freeze();
    } else {
      this.flags ??= new AttachmentFlags().freeze();
    }
    if ('title' in data) {
      this.title = data.title;
    } else {
      this.title ??= null;
    }
  }
  get spoiler() {
    return Util.basename(this.url ?? this.name).startsWith('SPOILER_');
  }
  toJSON() {
    return Util.flatten(this);
  }
}
module.exports = MessageAttachment;
