'use strict';
const { Presence } = require('./Presence');
const { TypeError } = require('../errors');
const { ActivityTypes, Opcodes } = require('../util/Constants');
const CustomStatusActivityTypes = [ActivityTypes.CUSTOM, ActivityTypes[ActivityTypes.CUSTOM]];
class ClientPresence extends Presence {
  constructor(client, data = {}) {
    super(client, Object.assign(data, { status: data.status ?? 'online', user: { id: null } }));
  }
  set(presence) {
    const packet = this._parse(presence);
    this._patch(packet);
    packet.activities = this.activities.map(a => a.toJSON());
    this.client.ws.broadcast({ op: Opcodes.STATUS_UPDATE, d: packet });
    return this;
  }
  _parse({ status, since, afk, activities }) {
    const data = {
      activities: [],
      afk: typeof afk === 'boolean' ? afk : this.afk,
      since: typeof since === 'number' && !Number.isNaN(since) ? this.since : 0,
      status: status ?? this.status,
    };
    if (activities?.length) {
      for (const [i, activity] of activities.entries()) {
        if (typeof activity.name !== 'string') throw new TypeError('INVALID_TYPE', `activities[${i}].name`, 'string');
        activity.type ??= ActivityTypes.PLAYING;
        if (typeof activity.type === 'string') activity.type = ActivityTypes[activity.type];
        if (CustomStatusActivityTypes.includes(activity.type) && !activity.state) {
          activity.state = activity.name;
          activity.name = 'Custom Status';
        }
        data.activities.push(activity);
      }
    } else if (!activities && (status || afk || since) && this.activities.length) {
      data.activities.push(
        ...this.activities.map(a => {
          if (typeof a.type === 'string') a.type = ActivityTypes[a.type];
          return a;
        }),
      );
    }
    return data;
  }
}
module.exports = ClientPresence;
