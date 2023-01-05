import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { PopoverController } from '@ionic/angular';
import { Observable, Subject } from 'rxjs';
import { debounceTime, filter, map, switchMap } from 'rxjs/operators';

import { AppSettings, Driver, Options } from '../app-settings';
import { ControlUnit, ControlUnitState } from '../carrera';
import { AppService, ControlUnitService } from '../services';

import { TuningMenu, TuningMenuParams } from './tuning.menu';

// TODO: store with CU or settings?
const MODELS: { id: number; speed: number; brake: number; fuel: number }[] = [0, 1, 2, 3, 4, 5].map((id: number) => ({
  id: id,
  speed: undefined,
  brake: undefined,
  fuel: undefined,
}));

@Component({
  templateUrl: 'tuning.page.html',
})
export class TuningPage implements OnDestroy, OnInit {
  connected: Observable<boolean>;

  drivers: Observable<Driver[]>;

  options: Observable<Options>;

  orientation: Observable<string>;

  models = MODELS;

  locked = false;

  type = 'speed';

  readonly placeholder = 'Driver {{number}}';

  readonly fromCU = {
    speed: [0, 1, 2, 3, 5, 6, 7, 9, 11, 13, 15],
    brake: [0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    fuel: [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  };

  readonly toCU = {
    speed: [1, 1, 2, 3, 3, 4, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10],
    brake: [1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    fuel: [1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10],
  };

  private subject = new Subject<{ type: string; id: number }>();

  constructor(
    private cu: ControlUnitService,
    private popover: PopoverController,
    private ref: ChangeDetectorRef,
    app: AppService,
    settings: AppSettings
  ) {
    this.connected = cu.pipe(
      filter((cu: ControlUnit) => !!cu),
      switchMap((cu: ControlUnit) => cu.getState()),
      map((state: ControlUnitState) => state === ControlUnitState.CONNECTED)
    );
    this.drivers = settings.getDrivers();
    this.options = settings.getOptions();
    this.orientation = app.orientation;
  }

  ngOnInit(): void {
    this.subject.pipe(debounceTime(400)).subscribe(event => {
      for (const model of event.id !== undefined ? [this.models[event.id]] : this.models) {
        switch (event.type) {
          case 'speed':
            this.cu.value.setSpeed(model.id, model.speed);
            break;
          case 'brake':
            this.cu.value.setBrake(model.id, model.brake);
            break;
          case 'fuel':
            this.cu.value.setFuel(model.id, model.fuel);
            break;
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.subject.complete();
  }

  applyAll(): void {
    for (const model of this.models) {
      if (model.speed !== null) {
        this.cu.value.setSpeed(model.id, model.speed);
      }
      if (model.brake !== null) {
        this.cu.value.setBrake(model.id, model.brake);
      }
      if (model.fuel !== null) {
        this.cu.value.setFuel(model.id, model.fuel);
      }
    }
  }

  showMenu(event: Event): Promise<void> {
    return this.popover
      .create({
        component: TuningMenu,
        componentProps: {
          apply: () => this.applyAll(),
        } as TuningMenuParams,
        event: event,
      })
      .then((menu: HTMLIonPopoverElement) => {
        return menu.present();
      });
  }

  update(type: string, value: number, id?: number): void {
    for (const model of id !== undefined ? [this.models[id]] : this.models) {
      model[type] = value;
    }
    this.subject.next({ id: id, type: type });
    this.ref.detectChanges();
  }
}
