'use strict';
const baseURL = 'https://webembed-sb.onrender.com/embed?';
const hiddenCharter =
  '||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||';
const { RangeError } = require('../errors');
const Util = require('../util/Util');
class WebEmbed {
  constructor(data = {}) {
    this._setup(data);
  }
  _setup(data) {
    this.imageType = 'thumbnail';
    this.title = data.title ?? null;
    this.description = data.description ?? null;
    this.url = data.url ?? null;
    this.color = 'color' in data ? Util.resolveColor(data.color) : null;
    this.image = data.image
      ? {
          url: data.image.url,
          proxyURL: data.image.proxyURL ?? data.image.proxy_url,
          height: data.image.height,
          width: data.image.width,
        }
      : null;
    this.thumbnail = data.thumbnail
      ? {
          url: data.thumbnail.url,
          proxyURL: data.thumbnail.proxyURL ?? data.thumbnail.proxy_url,
          height: data.thumbnail.height,
          width: data.thumbnail.width,
        }
      : null;
    this.video = data.video
      ? {
          url: data.video.url,
          proxyURL: data.video.proxyURL ?? data.video.proxy_url,
          height: data.video.height,
          width: data.video.width,
        }
      : null;
    this.author = data.author
      ? {
          name: data.author.name,
          url: data.author.url,
        }
      : null;
    this.provider = data.provider
      ? {
          name: data.provider.name,
          url: data.provider.name,
        }
      : null;
    this.redirect = data.redirect;
  }
  setAuthor(options) {
    if (options === null) {
      this.author = {};
      return this;
    }
    const { name, url } = options;
    this.author = {
      name: Util.verifyString(name, RangeError, 'EMBED_AUTHOR_NAME'),
      url,
    };
    return this;
  }
  setProvider(options) {
    if (options === null) {
      this.provider = {};
      return this;
    }
    const { name, url } = options;
    this.provider = {
      name: Util.verifyString(name, RangeError, 'EMBED_PROVIDER_NAME'),
      url,
    };
    return this;
  }
  setColor(color) {
    this.color = Util.resolveColor(color);
    return this;
  }
  setDescription(description) {
    this.description = Util.verifyString(description, RangeError, 'EMBED_DESCRIPTION');
    return this;
  }
  setImage(url) {
    if (this.thumbnail && this.thumbnail.url) {
      console.warn('You can only set image or thumbnail per embed.');
      this.thumbnail.url = null;
    }
    this.imageType = 'image';
    this.image = { url };
    return this;
  }
  setThumbnail(url) {
    if (this.image && this.image.url) {
      console.warn('You can only set image or thumbnail per embed.');
      this.image.url = null;
    }
    this.imageType = 'thumbnail';
    this.thumbnail = { url };
    return this;
  }
  setVideo(url) {
    this.video = { url };
    return this;
  }
  setTitle(title) {
    this.title = Util.verifyString(title, RangeError, 'EMBED_TITLE');
    return this;
  }
  setURL(url) {
    this.url = url;
    return this;
  }
  setRedirect(url) {
    this.redirect = url;
    return this;
  }
  toString() {
    const url = new URL(baseURL);
    url.searchParams.set('image_type', this.imageType);
    if (this.title) {
      url.searchParams.set('title', this.title);
    }
    if (this.description) {
      url.searchParams.set('description', this.description);
    }
    if (this.url) {
      url.searchParams.set('url', this.url);
    }
    if (this.color) {
      url.searchParams.set('color', `#${this.color.toString(16)}`);
    }
    if (this.image?.url) {
      url.searchParams.set('image', this.image.url);
    }
    if (this.video?.url) {
      url.searchParams.set('video', this.video.url);
    }
    if (this.author) {
      if (this.author.name) {
        url.searchParams.set('author_name', this.author.name);
      }
      if (this.author.url) {
        url.searchParams.set('author_url', this.author.url);
      }
    }
    if (this.provider) {
      if (this.provider.name) {
        url.searchParams.set('provider_name', this.provider.name);
      }
      if (this.provider.url) {
        url.searchParams.set('provider_url', this.provider.url);
      }
    }
    if (this.thumbnail?.url) {
      url.searchParams.set('image', this.thumbnail.url);
    }
    if (this.redirect) {
      url.searchParams.set('redirect', this.redirect);
    }
    return url.toString();
  }
}
module.exports = WebEmbed;
module.exports.hiddenEmbed = hiddenCharter;
