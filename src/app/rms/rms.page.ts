import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, from, merge, Observable, of, Subscription } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  mergeMap,
  pairwise,
  share,
  skipWhile,
  startWith,
  switchMap,
  take,
  withLatestFrom,
} from 'rxjs/operators';

import { AppSettings, Driver, Notifications, Options, RaceOptions, SessionType } from '../app-settings';
import { ControlUnit } from '../carrera';
import { AppService, ControlUnitService, LoggingService, SpeechService } from '../services';

import { LeaderboardItem } from './leaderboard';
import { RmsMenu } from './rms.menu';
import { Entry, Session } from './session';

type CompareLeaderboardItem = {
  position: (lhs: LeaderboardItem, rhs: LeaderboardItem) => number;
  number: (lhs: LeaderboardItem, rhs: LeaderboardItem) => number;
};

const compare: CompareLeaderboardItem = {
  position: (lhs: LeaderboardItem, rhs: LeaderboardItem) => {
    return lhs.position - rhs.position;
  },
  number: (lhs: LeaderboardItem, rhs: LeaderboardItem) => {
    return lhs.id - rhs.id;
  },
};

@Component({
  templateUrl: 'rms.page.html',
})
export class RmsPage implements OnDestroy, OnInit {
  mode: SessionType;

  session: Session;

  options: Options;

  pitlane: Observable<boolean>;
  sectors: Observable<boolean>;
  items: Observable<LeaderboardItem[]>;

  lapcount: Observable<{ count: number; total: number }>;

  start: Observable<number>;
  timer: Observable<number>;

  android: boolean;

  private subscriptions: Subscription;

  private backButtonSubscription: Subscription;

  private dataSubscription: Subscription;

  private subscription = new Subscription();

  constructor(
    public cu: ControlUnitService,
    private app: AppService,
    private logger: LoggingService,
    private settings: AppSettings,
    private speech: SpeechService,
    private popover: PopoverController,
    private translate: TranslateService,
    route: ActivatedRoute
  ) {
    this.mode = (route.snapshot.paramMap.get('mode') as SessionType) || SessionType.PRACTICE; // assume constant for page

    const cuMode: Observable<number> = cu.pipe(
      filter(cu => !!cu),
      mergeMap(cu => cu.getMode()),
      startWith(0),
      distinctUntilChanged()
    );

    // TODO: pitlane flag is actually (cuMode & 0x04), rename to fuelMode?
    this.pitlane = cuMode.pipe(map((value: number) => (value & 0x03) !== 0));

    this.sectors = settings.getOptions().pipe(map((options: Options) => options.sectors));

    this.start = cu.pipe(
      filter(cu => !!cu),
      mergeMap(cu => cu.getStart()),
      distinctUntilChanged()
    );

    this.android = app.isAndroid() && app.isCordova();
  }

  ngOnInit(): void {
    this.subscription.add(
      combineLatest([this.cu, this.getRaceOptions(this.mode)]).subscribe(([cu, options]: [ControlUnit, RaceOptions]) => {
        if (cu && options) {
          this.session = this.startSession(cu, options);
        } else {
          this.session = null;
        }
      })
    );
    this.subscription.add(
      this.settings.getOptions().subscribe((options: Options) => {
        this.options = options;
      })
    );
  }

  startSession(cu: ControlUnit, options: RaceOptions): Session {
    const session = new Session(cu, options);

    this.lapcount = session.currentLap.pipe(
      map((lap: number) => {
        return {
          count: lap,
          total: options.laps,
        };
      })
    );

    const drivers: Observable<Driver[]> = this.settings.getDrivers().pipe(
      switchMap((drivers: Driver[]) => {
        const driverTranslations$: Observable<Driver>[] = drivers.map((obj: Driver, index: number) => {
          const code: string = obj.code || '#' + (index + 1);
          if (obj.name) {
            return of({ name: obj.name, code: code, color: obj.color });
          } else {
            return this.getTranslations('Driver {{number}}', {
              number: index + 1,
            }).pipe(
              map((name: string) => {
                return { name: name, code: code, color: obj.color };
              })
            );
          }
        });
        return combineLatest(driverTranslations$);
      })
    );

    const best = [Infinity, Infinity, Infinity, Infinity];
    const events: Observable<[string, Driver]> = merge(
      session.grid.pipe(
        map((obs: Observable<Entry>) => obs.pipe(pairwise())),
        mergeMap((obs: Observable<[Entry, Entry]>) => obs),
        mergeMap(([prev, curr]: [Entry, Entry]) => {
          const events: [string, number][] = [];
          curr.best.forEach((time: number, index: number) => {
            if ((time || Infinity) < best[index]) {
              best[index] = time;
              if (curr.laps >= 3) {
                events.push([index ? 'bests' + index : 'bestlap', curr.id]);
              }
            }
          });
          if (!curr.finished && curr.time) {
            if (curr.fuel < prev.fuel) {
              events.push(['fuel' + curr.fuel, curr.id]);
            }
            if (curr.pit && !prev.pit) {
              events.push(['pitenter', curr.id]);
            }
            if (!curr.pit && prev.pit) {
              events.push(['pitexit', curr.id]);
            }
          }
          return from(events);
        })
      ),
      session.ranking.pipe(
        filter((items: Entry[]) => items.length !== 0 && options.mode === SessionType.RACE),
        map((items: Entry[]) => items[0]),
        pairwise(),
        filter(([prev, curr]: [Entry, Entry]) => prev.id !== curr.id),
        map(([_prev, curr]: [Entry, Entry]) => ['newleader', curr.id])
      ),
      this.start.pipe(
        distinctUntilChanged(),
        filter((value: number) => value === 9),
        map(() => {
          return ['falsestart', null];
        })
      ),
      this.lapcount.pipe(
        filter((laps: { count: number; total: number }) => {
          return options.laps && laps.count === options.laps && !session.finished.value;
        }),
        map(() => {
          return ['finallap', null];
        })
      ),
      session.yellowFlag.pipe(
        distinctUntilChanged(),
        skipWhile(value => !value),
        map((value: boolean) => {
          return [value ? 'yellowflag' : 'greenflag', null];
        })
      ),
      session.finished.pipe(
        distinctUntilChanged(),
        filter((finished: boolean) => finished),
        map(() => {
          return [options.mode === SessionType.RACE ? 'finished' : 'endsession', null];
        })
      )
    ).pipe(
      withLatestFrom(drivers),
      map(([[event, id], drivers]: [[string, number], Driver[]]) => {
        return [event, id !== null ? drivers[id] : null];
      })
    );

    const order: Observable<'number' | 'position'> = this.settings
      .getOptions()
      .pipe(map((options: Options) => (options.fixedorder ? 'number' : 'position')));
    const gridpos: number[] = [];
    const pitfuel: number[] = [];
    this.items = combineLatest([session.ranking, drivers, order]).pipe(
      map(([ranks, drivers, order]: [Entry[], Driver[], 'number' | 'position']) => {
        const items: LeaderboardItem[] = ranks.map((item: Entry, index: number) => {
          if (options.mode === SessionType.RACE && gridpos[item.id] === undefined && item.time !== undefined) {
            gridpos[item.id] = index;
          }
          if (!item.pit || item.fuel < pitfuel[item.id]) {
            pitfuel[item.id] = item.fuel;
          }
          return Object.assign({}, item, {
            position: index,
            driver: drivers[item.id],
            gridpos: gridpos[item.id],
            refuel: item.pit && item.fuel > pitfuel[item.id],
          }) as LeaderboardItem;
        });
        items.sort(compare[order || 'position']);
        return items;
      }),
      share()
    );

    if (this.subscriptions) {
      this.subscriptions.unsubscribe();
    }
    this.subscriptions = events
      .pipe(
        withLatestFrom(
          this.settings.getOptions(),
          this.settings.getNotifications(),
          this.getTranslations('notifications')
          // TODO: create Enum for possible Events
        )
      )
      .subscribe(([[event, driver], options, notifications, translations]: [[string, Driver], Options, Notifications, string]) => {
        this.logger.debug('Race event: ' + event, driver);
        if (options.speech && notifications[event]?.enabled) {
          const message = notifications[event].message || translations[event];
          if (driver?.name) {
            this.speech.speak(driver.name + ': ' + message);
          } else {
            this.speech.speak(message);
          }
        }
      });

    this.subscriptions.add(
      this.lapcount.subscribe(
        laps => {
          cu.setLap(laps.count);
        },
        error => {
          this.logger.error('Lap counter error:', error);
        },
        () => {
          this.logger.info('Lap counter finished');
        }
      )
    );

    if (options.mode !== SessionType.PRACTICE) {
      const start: Observable<number> = cu.getStart();
      start
        .pipe(take(1))
        .toPromise()
        .then((value: number) => {
          if (value === 0) {
            cu.toggleStart();
          }
          // wait until startlight goes off; TODO: subscribe/unsubscribe?
          cu.getStart()
            .pipe(
              pairwise(),
              filter(([prev, curr]: [number, number]) => {
                return prev !== 0 && curr === 0;
              }),
              take(1)
            )
            .toPromise()
            .then(() => {
              this.logger.info('Start ' + options.mode + ' mode');
              session.start();
            });
        });
    }

    return session;
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.subscriptions) {
      this.subscriptions.unsubscribe();
    }
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  ionViewDidEnter(): void {
    this.backButtonSubscription = this.app.backButton.subscribe(() => {
      // TODO: confirm or press back button twice?
      if (this.cu.value) {
        this.cu.value
          .disconnect()
          .catch((error: Error) => {
            this.logger.error('Error disconnecting from CU:', error);
          })
          .then(() => {
            this.app.exit();
          });
      } else {
        this.app.exit();
      }
    });
  }

  ionViewWillLeave(): void {
    this.backButtonSubscription.unsubscribe();
  }

  restartSession(): void {
    if (this.session) {
      this.session = this.startSession(this.session.cu, this.session.options);
    }
  }

  cancelSession(): void {
    if (this.session) {
      this.session.stop();
    }
  }

  private getRaceOptions(mode: SessionType): Observable<RaceOptions> {
    switch (mode) {
      case SessionType.RACE:
        return this.settings.getRaceSettings();
      case SessionType.QUALIFYING:
        return this.settings.getQualifyingSettings();
      default:
        return of(new RaceOptions(SessionType.PRACTICE));
    }
  }

  toggleSpeech(): void {
    if (this.options) {
      this.settings.setOptions(Object.assign({}, this.options, { speech: !this.options.speech })).catch((e: Error) => this.logger.error(e));
    }
  }

  toggleYellowFlag(): void {
    if (this.session) {
      this.session.toggleYellowFlag();
    }
  }

  showMenu(event: Event): Promise<void> {
    return this.popover
      .create({
        component: RmsMenu,
        componentProps: {
          mode: this.mode,
          active: this.session && !this.session.finished.value && this.mode !== 'practice',
          restart: () => this.restartSession(),
          cancel: () => this.cancelSession(),
        },
        event: event,
      })
      .then((menu: HTMLIonPopoverElement) => {
        return menu.present();
      });
  }

  // see https://github.com/ngx-translate/core/issues/330
  private getTranslations(key: string, params?: unknown): Observable<string> {
    return this.translate.stream(key, params);
  }
}
