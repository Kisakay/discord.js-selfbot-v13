'use strict';
const { Collection } = require('@discordjs/collection');
const Base = require('./Base');
const WelcomeChannel = require('./WelcomeChannel');
class WelcomeScreen extends Base {
  constructor(guild, data) {
    super(guild.client);
    this.guild = guild;
    this.description = data.description ?? null;
    this.welcomeChannels = new Collection();
    for (const channel of data.welcome_channels) {
      const welcomeChannel = new WelcomeChannel(this.guild, channel);
      this.welcomeChannels.set(welcomeChannel.channelId, welcomeChannel);
    }
  }
  get enabled() {
    return this.guild.features.includes('WELCOME_SCREEN_ENABLED');
  }
}
module.exports = WelcomeScreen;
