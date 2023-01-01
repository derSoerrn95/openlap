import { BehaviorSubject, GroupedObservable, interval, merge, Observable } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  groupBy,
  map,
  mergeMap,
  publishReplay,
  refCount,
  scan,
  share,
  startWith,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

import { RaceOptions } from '../app-settings';
import { ControlUnit, ControlUnitState, Triple } from '../carrera';

const TIMER_INTERVAL: number = 500;

function createMask(first: number, last: number): number {
  let mask = 0;
  while (first !== last) {
    mask |= 1 << first;
    ++first;
  }
  return mask;
}

export interface Entry {
  id: number;
  time: number;
  laps: number;
  last: number[];
  best: number[];
  times: number[][];
  fuel?: number;
  pit?: boolean;
  pits?: number;
  sector: number;
  finished?: boolean;
}

function numCompare(lhs: number, rhs: number): number {
  const r = lhs - rhs;
  if (!isNaN(r)) {
    return r;
  } else if (isNaN(lhs)) {
    return isNaN(rhs) ? 0 : 1;
  } else {
    return -1;
  }
}

function timeCompare(lhs: Entry, rhs: Entry): number {
  return (lhs.best[0] || Infinity) - (rhs.best[0] || Infinity);
}

function raceCompare(lhs: Entry, rhs: Entry): number {
  return rhs.laps - lhs.laps || numCompare(lhs.time, rhs.time) || lhs.id - rhs.id;
}

const COMPARE: { [key: string]: (a: Entry, b: Entry) => number } = {
  practice: timeCompare,
  qualifying: timeCompare,
  race: raceCompare,
};

export class Session {
  grid: Observable<Observable<Entry>>;
  ranking: Observable<Entry[]>;
  currentLap: Observable<number>;
  finished = new BehaviorSubject<boolean>(false);
  yellowFlag = new BehaviorSubject<boolean>(false);
  timer: Observable<number>;
  started = false;
  stopped = false;

  private mask: number;
  private active: number = 0;

  private realMask: number;

  // TODO: move settings handling/combine to race-control!
  constructor(public cu: ControlUnit, public options: RaceOptions) {
    const compare = COMPARE[options.mode];

    const reset: Observable<boolean> = merge(
      cu.getStart().pipe(
        distinctUntilChanged(),
        filter((start: number) => start !== 0)
      ),
      cu.getState().pipe(filter((state: ControlUnitState) => state === ControlUnitState.CONNECTED))
    ).pipe(
      map((_state: ControlUnitState) => {
        cu.setMask(this.mask);
        return true;
      })
    );
    // create monotonic timer
    type TimerType = Triple;
    const timer: Observable<Triple> = cu.getTimer().pipe(
      filter(([id]: Triple) => {
        return !(this.mask & (1 << id));
      }),
      scan(
        ([_, [prev, offset, then]]: number[][], [id, time, group]: TimerType) => {
          // TODO: combine with reset?
          const now: number = Date.now();
          if (time < prev) {
            offset = (now - then + prev || 0) - time;
          }
          return [
            [id, time + offset, group],
            [time, offset, now],
          ];
        },
        [[], [Infinity, 0, NaN]]
      ),
      map(([t]: TimerType[]) => t)
    );
    const fuel = cu.getFuel();
    const pit = cu.getPit();

    this.mask = (options.auto ? 0 : 1 << 6) | (options.pace ? 0 : 1 << 7);
    if (options.drivers) {
      this.mask |= createMask(options.drivers, 6);
      this.grid = this.createGrid(timer, fuel, pit, ~this.mask & 0xff);
    } else {
      this.grid = this.createGrid(timer, fuel, pit);
    }

    this.ranking = reset.pipe(
      startWith(false),
      /*combineLatest(this.grid),
      map(([_, grid]: [boolean, Observable<Entry>]) => {
        return grid; // for reset side effects only...
      }),*/
      /*mergeAll(),*/ // combineLatest was marked as deprecated, so changed into mergeMap. But I don't understand why we're using Observable<Observable<Entry>> instead of just Observable<Entry>
      mergeMap(() => this.grid),
      map((grid: Observable<Entry>) => {
        return grid; // for reset side effects only...
      }),
      mergeMap((val: Observable<Entry>) => val),
      scan((grid: Entry[], event: Entry) => {
        const newGrid: Entry[] = [...grid];
        newGrid[event.id] = event;
        return newGrid;
      }, []),
      map((cars: Entry[]) => {
        const ranks: Entry[] = cars.filter((car: Entry) => !!car);
        ranks.sort(compare);
        return ranks;
      })
    );

    this.currentLap = this.grid.pipe(
      /*mergeAll(),*/
      mergeMap((val: Observable<Entry>) => val),
      scan<Entry, number>((current: number, event: Entry) => {
        if (current > event.laps) {
          return current;
        } else if (this.finished.value || isNaN(event.time)) {
          return event.laps;
        } else {
          return event.laps + 1;
        }
      }, 0),
      startWith(0),
      publishReplay(1),
      refCount(),
      distinctUntilChanged()
    );

    if (options.time) {
      this.timer = interval(TIMER_INTERVAL).pipe(
        withLatestFrom(cu.getStart(), cu.getState()),
        filter(([_, start, state]) => {
          return this.started && (!this.options.pause || (start === 0 && state === ControlUnitState.CONNECTED));
        }),
        scan<[number, number, ControlUnitState], number>((time: number, _: [number, number, ControlUnitState]) => {
          return Math.max(0, time - TIMER_INTERVAL);
        }, options.time),
        tap((time: number) => {
          if (time === 0) {
            this.stopped = true;
            this.finish();
          }
        }),
        share(),
        startWith(options.time)
      );
    }

    this.cu.setMask(this.mask);
    this.cu.clearPosition();
    this.cu.reset();
  }

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.stopped = true;
    this.finish();
  }

  toggleYellowFlag(): void {
    const value = this.yellowFlag.value;
    if (this.yellowFlag.value) {
      this.mask = this.realMask;
      this.realMask = null;
    } else {
      this.realMask = this.mask;
      this.mask = 0xff;
    }
    this.cu.setMask(this.mask);
    this.yellowFlag.next(!value);
  }

  // TODO: why returning Observable in Observable?
  private createGrid(
    timer: Observable<[number, number, number]>,
    fuel: Observable<ArrayLike<number>>,
    pits: Observable<number>,
    mask: number = 0
  ): Observable<Observable<Entry>> {
    const init: [number, number, number] = new Array<number>() as [number, number, number];
    for (let i = 0; mask; ++i) {
      if (mask & 1) {
        init.push(i, Number.NaN, 0);
      }
      mask >>>= 1;
    }
    return timer.pipe(
      startWith(...init),
      groupBy((triple: Triple) => triple[0]),
      map((group: GroupedObservable<number, Triple>) => {
        type TimeInfo = [number[][], number[], number[], boolean];
        this.active |= 1 << group.key;

        const times = group.pipe(
          scan(
            ([times, last, best, finished]: TimeInfo, [id, time, sensor]: Triple) => {
              const tail = times[times.length - 1] || [];
              if (sensor && time > (tail.length >= sensor ? tail[sensor - 1] : -Infinity) + this.options.minLapTime) {
                if (sensor === 1) {
                  times.push([time]);
                  last[0] = time - tail[0];
                  best[0] = Math.min(last[0], best[0] || Infinity);
                  if (tail.length > 1) {
                    last[tail.length] = time - tail[tail.length - 1];
                    best[tail.length] = Math.min(last[tail.length], best[tail.length] || Infinity);
                  }
                  if (!finished && this.isFinished(times.length - 1)) {
                    this.finish(id);
                    finished = true;
                  }
                } else {
                  const index = sensor - 1;
                  tail[index] = time;
                  last[index] = time - tail[index - 1];
                  best[index] = Math.min(last[index], best[index] || Infinity);
                }
              }
              return [times, last, best, finished] as TimeInfo;
            },
            [[], [], [], false] as TimeInfo
          )
        );

        return times.pipe(
          withLatestFrom(
            pits.pipe(
              map((mask: number) => (mask & ~this.mask & (1 << group.key)) !== 0),
              distinctUntilChanged(),
              scan(
                ([count]: [number], isInPit: boolean) => {
                  return [isInPit ? count + 1 : count, isInPit];
                },
                [0, false]
              )
            ),
            fuel.pipe(
              map(fuel => fuel[group.key]),
              distinctUntilChanged()
            )
          ),
          map(([[times, last, best, finished], [pits, pit], fuel]: [TimeInfo, [number, boolean], number]) => {
            const laps: number = times.length ? times.length - 1 : 0;
            const curr: number[] = times[times.length - 1] || [];
            const prev: number[] = times[times.length - 2] || [];
            return {
              id: group.key,
              time: curr[0],
              laps: laps,
              last: last,
              best: best,
              times: times,
              fuel: fuel,
              pit: pit,
              pits: pits,
              sector: curr.length - 1 || prev.length,
              finished: finished,
            };
          }),
          publishReplay(1),
          refCount()
        );
      }),
      publishReplay(),
      refCount()
    );
  }

  private finish(id?: number): void {
    const mask: number = this.mask;
    this.mask |= ~this.active & 0xff;
    if (id !== undefined) {
      this.mask |= 1 << id;
    }
    if (mask !== this.mask) {
      this.cu.setMask(this.mask);
    }
    if (id !== undefined) {
      this.cu.setFinished(id);
    }
    this.finished.next(true);
  }

  private isFinished(laps: number): boolean {
    if (this.stopped) {
      return true;
    } else if (this.options.laps && laps >= this.options.laps) {
      return true;
    } else {
      return !!(!this.options.slotmode && this.finished.value);
    }
  }
}
