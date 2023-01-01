import { Component, OnDestroy, OnInit } from '@angular/core';

import { AppSettings, Options } from '../app-settings';
import { I18nAlertService } from '../services';

import { AboutPage } from './about.page';
import { ConnectionPage } from './connection.page';
import { LicensesPage } from './licenses.page';
import { LoggingPage } from './logging.page';
import { NotificationsPage } from './notifications.page';
import { Subscription } from 'rxjs';

@Component({
  templateUrl: 'settings.page.html',
})
export class SettingsPage implements OnDestroy, OnInit {
  aboutPage = AboutPage;
  connectionPage = ConnectionPage;
  licensesPage = LicensesPage;
  loggingPage = LoggingPage;
  notificationsPage = NotificationsPage;

  options: Options = new Options();

  private subscription: Subscription;

  constructor(private alert: I18nAlertService, private settings: AppSettings) {}

  ngOnInit(): void {
    this.subscription = this.settings.getOptions().subscribe(options => {
      this.options = options;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  reset(): void {
    this.alert
      .show({
        message: 'Reset all user settings to default values?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'OK',
            handler: () => {
              this.settings.clear().catch((e: Error) => console.log(e));
            },
          },
        ],
      })
      .catch((e: Error) => console.log(e));
  }

  update(): void {
    this.settings.setOptions(this.options).catch((e: Error) => console.log(e));
  }
}
