import { Component, OnDestroy, OnInit } from '@angular/core';
import { PopoverController } from '@ionic/angular';

import { AppSettings, Options } from '../app-settings';
import { AppService, LoggingService } from '../services';
import { Subscription } from 'rxjs';

function stringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    return '' + obj;
  }
}

@Component({
  templateUrl: 'logging.menu.html',
})
export class LoggingMenu implements OnDestroy, OnInit {
  private options = new Options();

  private subscription: Subscription;

  share: () => void = undefined;

  get debugEnabled(): boolean {
    return this.options.debug;
  }

  set debugEnabled(value: boolean) {
    this.options.debug = value;
    this.settings.setOptions(this.options).catch((e: Error) => this.logger.error(e));
    this.dismiss().catch((e: Error) => this.logger.error(e));
  }

  constructor(private app: AppService, public logger: LoggingService, private settings: AppSettings, private popover: PopoverController) {
    if (app.share) {
      this.share = () => this.doShare();
    }
  }

  ngOnInit(): void {
    this.subscription = this.settings.getOptions().subscribe({
      next: options => {
        this.options = options;
      },
      error: error => {
        this.logger.error('Logging settings: ', error);
      },
      complete: () => {
        this.logger.debug('Logging settings complete');
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  clear(): void {
    this.logger.clear();
    this.dismiss().catch((e: Error) => this.logger.error(e));
  }

  dismiss(): Promise<boolean> {
    return this.popover.dismiss();
  }

  private doShare(): void {
    Promise.all([this.app.getName(), this.app.getVersion(), this.app.getDeviceInfo()])
      .then(([name, version, device]) => {
        const message = this.logger.records
          .map(record => {
            return [record.level, record.time, record.args.map(stringify).join(' ')].join('\t');
          })
          .join('\n');
        const subject = name + ' ' + version + ' (' + [device.model, device.platform, device.version].join(' ') + ')';
        return this.app.share(subject, message);
      })
      .catch(error => {
        this.logger.error('Error sharing log:', error);
      })
      .then(() => {
        return this.dismiss();
      });
  }
}
