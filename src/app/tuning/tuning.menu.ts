import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavParams, PopoverController } from '@ionic/angular';

import { AppSettings, Options } from '../app-settings';
import { LoggingService } from '../services';
import { Subscription } from 'rxjs';

export type TuningMenuParams = {
  apply: () => void;
};

@Component({
  templateUrl: 'tuning.menu.html',
})
export class TuningMenu implements OnDestroy, OnInit {
  private options = new Options();
  private params: TuningMenuParams;
  private subscription: Subscription;

  get mode(): boolean {
    return this.options.cumode;
  }

  set mode(value: boolean) {
    this.options.cumode = value;
    this.settings.setOptions(this.options).catch((e: Error) => this.logger.error(e));
    this.dismiss().catch((e: Error) => this.logger.error(e));
  }

  constructor(private logger: LoggingService, private settings: AppSettings, private popover: PopoverController, params: NavParams) {
    this.params = params.data as TuningMenuParams;
  }

  ngOnInit(): void {
    this.subscription = this.settings.getOptions().subscribe({
      next: options => {
        this.options = options;
      },
      error: error => {
        this.logger.error('Tuning settings: ', error);
      },
      complete: () => {
        this.logger.debug('Tuning settings complete');
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  applyAll(): void {
    this.params.apply();
    this.dismiss().catch((e: Error) => this.logger.error(e));
  }

  private dismiss(): Promise<boolean> {
    return this.popover.dismiss();
  }
}
