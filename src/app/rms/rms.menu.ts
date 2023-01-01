import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavParams, PopoverController } from '@ionic/angular';

import { AppSettings, Options } from '../app-settings';
import { I18nAlertService } from '../services';
import { Subscription } from 'rxjs';

export type Params = {
  mode: string;
  active: boolean;
  restart: () => void;
  cancel: () => void;
};

@Component({
  templateUrl: 'rms.menu.html',
})
export class RmsMenu implements OnDestroy, OnInit {
  options = new Options();

  params: Params;

  private subscription: Subscription;

  constructor(private alert: I18nAlertService, private settings: AppSettings, private popover: PopoverController, params: NavParams) {
    this.params = params.data as Params; // FIXME
  }

  get sectors(): boolean {
    return this.options.sectors;
  }

  set sectors(value: boolean) {
    this.options.sectors = value;
    this.settings.setOptions(this.options).catch((e: Error) => console.log(e));
    this.dismiss().catch((e: Error) => console.log(e));
  }

  get fixedOrder(): boolean {
    return this.options.fixedorder;
  }

  set fixedOrder(value: boolean) {
    this.options.fixedorder = value;
    this.settings.setOptions(this.options).catch((e: Error) => console.log(e));
    this.dismiss().catch((e: Error) => console.log(e));
  }

  ngOnInit(): void {
    this.subscription = this.settings.getOptions().subscribe(options => {
      this.options = options;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onRestart(): void {
    this.dismiss().then(() => {
      if (this.params.active) {
        this.alert
          .show({
            message: 'Restart ' + this.params.mode + '?',
            buttons: [
              {
                text: 'Cancel',
                role: 'cancel',
              },
              {
                text: 'OK',
                handler: () => this.params.restart(),
              },
            ],
          })
          .catch((e: Error) => console.log(e));
      } else {
        this.params.restart();
      }
    });
  }

  onCancel(): void {
    this.dismiss().then(() => {
      if (this.params.active) {
        this.alert
          .show({
            message: 'Cancel ' + this.params.mode + '?',
            buttons: [
              {
                text: 'Cancel',
                role: 'cancel',
              },
              {
                text: 'OK',
                handler: () => this.params.cancel(),
              },
            ],
          })
          .catch((e: Error) => console.log(e));
      } else {
        this.params.cancel();
      }
    });
  }

  private dismiss(): Promise<boolean> {
    return this.popover.dismiss({});
  }
}
