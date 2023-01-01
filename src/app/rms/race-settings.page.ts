import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalController, NavParams, SegmentChangeEventDetail } from '@ionic/angular';

import { RaceOptions, SessionType } from '../app-settings';

interface QualifyingForm {
  time: FormControl<string>;
  pause: FormControl<boolean>;
  drivers: FormControl<string>;
  auto: FormControl<boolean>;
  pace: FormControl<boolean>;
}

interface RaceForm extends QualifyingForm {
  laps: FormControl<number>;
  slotmode: FormControl<boolean>;
}

interface OptionsForm {
  laps: number;
  time: string;
  pause: boolean;
  drivers: string;
  auto: boolean;
  pace: boolean;
  slotmode: boolean;
}

function formatTime(milliseconds: number): string {
  const h = Math.floor(milliseconds / 3600000);
  const m = Math.floor((milliseconds / 60000) % 60);
  const s = Math.floor((milliseconds / 1000) % 60);
  return [h, m, s].map((v: number) => ('0' + v).substring(-2)).join(':');
}

function parseTime(s: string): number {
  return s.split(':').reduce((sum: number, cur: string) => sum * 60 + parseInt(cur), 0) * 1000;
}

function timeRequired(control: AbstractControl): { required: boolean } {
  if (!control.value || !parseTime(control.value)) {
    return { required: true };
  } else {
    return null;
  }
}

function lapsOrTimeRequired(group: FormGroup<RaceForm>): { required: boolean } {
  const laps = group.controls.laps.value;
  if (laps && laps > 0) {
    return null;
  }
  if (!timeRequired(group.get('time'))) {
    return null;
  }
  return { required: true };
}

function createQualifyingForm(params: NavParams): FormGroup<QualifyingForm> {
  return new FormGroup<QualifyingForm>({
    time: new FormControl<string>(formatTime(params.get('time') || 180000), timeRequired),
    pause: new FormControl<boolean>({
      value: params.get('pause') || false,
      disabled: !params.get('time'),
    }),
    drivers: new FormControl<string>(params.get('drivers') || ''),
    auto: new FormControl<boolean>(params.get('auto') || false),
    pace: new FormControl<boolean>(params.get('pace') || false),
  });
}

function createRaceForm(params: NavParams): FormGroup<RaceForm> {
  return new FormGroup<RaceForm>(
    {
      laps: new FormControl<number>(parseInt(params.get('laps') ?? ''), Validators.pattern('\\d*')),
      time: new FormControl<string>(formatTime(params.get('time') || 0)),
      pause: new FormControl<boolean>({
        value: !!params.get('pause'),
        disabled: !params.get('time'),
      }),
      slotmode: new FormControl<boolean>({
        value: !!params.get('slotmode'),
        disabled: !params.get('laps'),
      }),
      drivers: new FormControl<string>(params.get('drivers') || ''),
      auto: new FormControl<boolean>(params.get('auto') || false),
      pace: new FormControl<boolean>(params.get('pace') || false),
    },
    [lapsOrTimeRequired]
  );
}

@Component({
  selector: 'race-settings',
  templateUrl: 'race-settings.page.html',
})
export class RaceSettingsPage implements AfterViewInit {
  mode: SessionType.QUALIFYING | SessionType.RACE;

  form: FormGroup;

  @ViewChild('pause', { static: true }) pauseToggle: ElementRef<HTMLIonToggleElement>;

  @ViewChild('slotmode') slotmodeToggle: ElementRef<HTMLIonToggleElement>;

  constructor(private params: NavParams, private modal: ModalController) {
    this.mode = params.get('mode');
    if (this.mode === SessionType.RACE) {
      this.form = createRaceForm(params);
    } else {
      this.form = createQualifyingForm(params);
    }
  }

  ngAfterViewInit(): void {
    // see https://github.com/driftyco/ionic/issues/9041
    if (this.pauseToggle) {
      this.pauseToggle.nativeElement.disabled = this.form.get('pause').disabled;
    }
    if (this.slotmodeToggle) {
      this.slotmodeToggle.nativeElement.disabled = this.form.get('slotmode').disabled;
    }
  }

  onChangeLaps(event: CustomEvent<SegmentChangeEventDetail>): void {
    if (parseInt(event.detail.value || '0') > 0) {
      this.form.get('slotmode').enable();
    } else {
      this.form.get('slotmode').disable();
    }
    if (this.slotmodeToggle) {
      this.slotmodeToggle.nativeElement.disabled = this.form.get('slotmode').disabled;
    }
  }

  onChangeTime(event: CustomEvent<SegmentChangeEventDetail>): void {
    if (parseTime(event.detail.value) !== 0) {
      this.form.get('pause').enable();
    } else {
      this.form.get('pause').disable();
    }
    if (this.pauseToggle) {
      this.pauseToggle.nativeElement.disabled = this.form.get('pause').disabled;
    }
  }

  onSubmit(options: OptionsForm): void {
    this.modal
      .dismiss(
        Object.assign(new RaceOptions(this.mode), {
          laps: options.laps || 0,
          time: parseTime(options.time || ''),
          pause: options.pause,
          drivers: options.drivers ? parseInt(options.drivers) : undefined,
          auto: options.auto,
          pace: options.pace,
          slotmode: options.slotmode,
        })
      )
      .catch((error: Error) => console.log(error));
  }

  onCancel(): void {
    this.modal.dismiss().catch((error: Error) => console.log(error));
  }
}
