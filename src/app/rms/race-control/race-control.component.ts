import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { combineLatest, Observable, of } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { ControlUnit, ControlUnitButton, ControlUnitState } from '../../carrera';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'race-control',
  styleUrls: ['race-control.component.scss'],
  templateUrl: 'race-control.component.html',
})
export class RaceControlComponent {
  private controlUnit: ControlUnit;

  lights: Observable<number>;
  blink: Observable<boolean>;
  keys: Promise<boolean>;

  @Input()
  set cu(cu: ControlUnit) {
    if (cu) {
      // TODO: share this?
      const start = cu.getStart().pipe(distinctUntilChanged());
      const state = cu.getState();
      this.lights = start.pipe(map((value: number) => (value === 1 ? 5 : value > 1 && value < 7 ? value - 1 : 0)));
      this.blink = combineLatest([start, state]).pipe(map(([value, state]) => value >= 8 || state !== ControlUnitState.CONNECTED));
      this.keys = cu.getVersion().then(version => version >= '5331');
    } else {
      this.lights = of(0);
      this.blink = of(false);
      this.keys = Promise.resolve(false);
    }
    this.controlUnit = cu;
  }

  get cu(): ControlUnit {
    return this.controlUnit;
  }

  @Input() yellowFlag: boolean;

  @Output() yellowFlagChange = new EventEmitter();

  togglePaceCar(): void {
    if (this.cu) {
      this.cu.trigger(ControlUnitButton.PACE_CAR);
    }
  }

  toggleStart(): void {
    if (this.cu) {
      this.cu.trigger(ControlUnitButton.START);
    }
  }
}
