import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SettingsService } from './services';

export enum SessionType {
  RACE = 'race',
  QUALIFYING = 'qualifying',
  PRACTICE = 'practice',
}

const COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#cccccc'];

export interface Notifications {
  falsestart: Notification;
  finished: Notification;
  finallap: Notification;
  bestlap: Notification;
  bests1: Notification;
  bests2: Notification;
  bests3: Notification;
  fuel2: Notification;
  fuel1: Notification;
  fuel0: Notification;
  pitenter: Notification;
  pitexit: Notification;
  yellowflag: Notification;
  greenflag: Notification;
  endsession: Notification;
  newleader: Notification;
}

const NOTIFICATIONS = {
  falsestart: true,
  finished: true,
  finallap: true,
  bestlap: true,
  bests1: false,
  bests2: false,
  bests3: false,
  fuel2: true,
  fuel1: true,
  fuel0: true,
  pitenter: false,
  pitexit: false,
  yellowflag: true,
  greenflag: true,
  endsession: true,
  newleader: true,
};

export class Connection {
  type: string;
  name: string;
  address?: string;
  connectionTimeout = 3000;
  requestTimeout = 2000;
  minReconnectDelay = 3000;
  maxReconnectDelay = 8000;
  demoControlUnit = false;
}

export class Options {
  cumode = true;
  debug = false;
  fixedorder = false;
  language = '';
  speech = true;
  sectors = false;
}

export interface Notification {
  enabled: boolean;
  message?: string;
}

export interface Driver {
  name?: string;
  code?: string;
  color: string;
}

export class RaceOptions {
  constructor(mode: SessionType) {
    this.mode = mode;
    switch (mode) {
      case SessionType.PRACTICE:
        this.laps = 0;
        this.time = 0;
        this.auto = true;
        this.pace = true;
        break;
      case SessionType.QUALIFYING:
        this.laps = 0;
        this.time = 3 * 60 * 1000;
        break;
      case SessionType.RACE:
        this.laps = 30;
        this.time = 0;
        break;
    }
  }

  mode: SessionType;

  laps: number;
  time: number;
  pause = false;
  slotmode = false;
  drivers?: number;
  auto = false;
  pace = false;
  minLapTime = 500; // FIXME: Configurable?
}

@Injectable({
  providedIn: 'root',
})
export class AppSettings {
  constructor(private settings: SettingsService) {}

  clear(): Promise<void> {
    return this.settings.clear();
  }

  async create(): Promise<Storage> {
    return this.settings.createDB();
  }

  getConnection(): Observable<Connection> {
    return this.settings.observe('connection').pipe(map(value => Object.assign(new Connection(), value)));
  }

  setConnection(value: Connection): Promise<void> {
    return this.settings.set('connection', value);
  }

  getDrivers(): Observable<Driver[]> {
    return this.settings.observe('drivers').pipe(
      map((value: Driver[]) => {
        const result: Driver[] = new Array<Driver>(8);
        for (let i = 0; i < result.length; i++) {
          result[i] = Object.assign({ color: COLORS[i] }, value ? value[i] : null);
        }
        return result;
      })
    );
  }

  setDrivers(value: Driver[]): Promise<void> {
    return this.settings.set('drivers', value);
  }

  getNotifications(): Observable<Notifications> {
    return this.settings.observe('notifications').pipe(
      map((value: Notifications) => {
        const result: Notifications = {} as Notifications;
        for (const key of Object.keys(NOTIFICATIONS)) {
          result[key] = Object.assign({ enabled: NOTIFICATIONS[key] }, value ? value[key] : null);
        }
        return result;
      })
    );
  }

  setNotifications(value: Notifications): Promise<void> {
    return this.settings.set('notifications', value);
  }

  getOptions(): Observable<Options> {
    return this.settings.observe('options').pipe(map((value: Options) => Object.assign(new Options(), value)));
  }

  setOptions(value: Options): Promise<void> {
    return this.settings.set('options', value);
  }

  getQualifyingSettings(): Observable<RaceOptions> {
    return this.settings
      .observe(SessionType.QUALIFYING)
      .pipe(map((value: RaceOptions) => Object.assign(new RaceOptions(SessionType.QUALIFYING), value)));
  }

  setQualifyingSettings(value: RaceOptions): Promise<void> {
    return this.settings.set(SessionType.QUALIFYING, value);
  }

  getRaceSettings(): Observable<RaceOptions> {
    return this.settings
      .observe(SessionType.RACE)
      .pipe(map((value: RaceOptions) => Object.assign(new RaceOptions(SessionType.RACE), value)));
  }

  setRaceSettings(value: RaceOptions): Promise<void> {
    return this.settings.set(SessionType.RACE, value);
  }
}
