import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';

import { AppSettings, Driver } from '../app-settings';
import { LoggingService, SpeechService } from '../services';
import { ItemReorderEventDetail } from '@ionic/angular';

@Component({
  selector: 'drivers',
  templateUrl: 'drivers.page.html',
})
export class DriversPage implements OnDestroy, OnInit {
  drivers: Driver[];

  readonly placeholder = 'Driver {{number}}';

  constructor(
    private logger: LoggingService,
    private settings: AppSettings,
    private speech: SpeechService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.settings
      .getDrivers()
      .pipe(take(1))
      .toPromise()
      .then((drivers: Driver[]) => {
        this.drivers = drivers;
      })
      .catch(error => {
        this.logger.error('Error getting drivers', error);
      });
  }

  ngOnDestroy(): void {
    this.settings.setDrivers(this.drivers).catch(error => {
      this.logger.error('Error setting drivers', error);
    });
  }

  getCode(name: string, id: number): string {
    const chars = name.replace(/\W/g, '').toUpperCase(); // TODO: proper Unicode support
    const codes = this.drivers.filter((_, index) => index !== id).map(obj => obj.code);
    for (let n = 2; n < chars.length; ++n) {
      const s = chars.substring(0, 2) + chars.substring(n, 1);
      if (codes.indexOf(s) === -1) {
        return s;
      }
    }
    return undefined;
  }

  reorderItems(event: CustomEvent<ItemReorderEventDetail>): void {
    const colors = this.drivers.map(driver => driver.color);
    const element = this.drivers[event.detail.from];
    this.drivers.splice(event.detail.from, 1);
    this.drivers.splice(event.detail.to, 0, element);
    colors.forEach((color, index) => {
      this.drivers[index].color = color;
    });
    event.detail.complete();
  }

  speak(id: number): void {
    this.getDriverName(id).then(name => {
      this.speech.speak(name);
    });
  }

  private getDriverName(id): Promise<string> {
    if (this.drivers[id]?.name) {
      return Promise.resolve(this.drivers[id].name);
    } else {
      return this.translate.get(this.placeholder, { number: id + 1 }).toPromise();
    }
  }
}
