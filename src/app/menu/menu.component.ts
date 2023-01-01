import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { take } from 'rxjs/operators';

import { AppSettings, RaceOptions } from '../app-settings';
import { ControlUnit } from '../carrera';
import { ColorsPage, DriversPage } from '../drivers';
import { RaceSettingsPage } from '../rms';
import { AppService, I18nAlertService, LoggingService } from '../services';
import { SettingsPage } from '../settings';
import { TuningPage } from '../tuning';

import { ConnectionsComponent } from './connections.component';

@Component({
  selector: 'menu',
  templateUrl: 'menu.component.html',
})
export class MenuComponent implements OnChanges {
  @Input() cu: ControlUnit;

  mode: boolean;

  open: boolean;

  version: Promise<string>;

  exitApp: () => void;

  colorsPage = ColorsPage;
  driversPage = DriversPage;
  settingsPage = SettingsPage;
  tuningPage = TuningPage;

  initialized: boolean = false;

  @ViewChild(ConnectionsComponent) connections: ConnectionsComponent;

  constructor(
    private app: AppService,
    private logger: LoggingService,
    private settings: AppSettings,
    private alert: I18nAlertService,
    private modal: ModalController,
    private nav: NavController
  ) {
    if (app.exit) {
      this.exitApp = () => this.onExitApp();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('cu' in changes) {
      this.mode = !!this.cu;
      this.version = this.cu ? this.cu.getVersion() : Promise.resolve(undefined);
    }
  }

  onMenuOpen(): void {
    // Web Bluetooth workaround - needs user gesture for scanning
    if (!this.initialized && this.connections) {
      if (navigator['bluetooth']) {
        this.connections.ngOnInit();
      }
      this.initialized = true;
    }
    this.open = true;
  }

  onMenuClose(): void {
    this.mode = !!this.cu;
    this.open = false;
  }

  onMenuToggle(): void {
    this.mode = !this.mode;
  }

  reconnect(): void {
    if (this.cu) {
      this.logger.info('Reconnecting to', this.cu.peripheral);
      this.cu.reconnect().then(() => {
        this.version = this.cu.getVersion();
      });
    }
  }

  startPractice(): Promise<boolean> {
    return this.nav.navigateRoot('rms/practice');
  }

  startQualifying(): void {
    this.settings
      .getQualifyingSettings()
      .pipe(take(1))
      .subscribe(options => {
        return this.modal
          .create({
            component: RaceSettingsPage,
            componentProps: options,
          })
          .then((modal: HTMLIonModalElement) => {
            modal.onDidDismiss().then((detail: { data: RaceOptions }) => {
              if (detail.data) {
                this.settings.setQualifyingSettings(detail.data).then(() => {
                  return this.nav.navigateRoot('rms/qualifying');
                });
              }
            });
            return modal.present();
          });
      });
  }

  startRace(): void {
    this.settings
      .getRaceSettings()
      .pipe(take(1))
      .subscribe((options: RaceOptions) => {
        return this.modal
          .create({
            component: RaceSettingsPage,
            componentProps: options,
          })
          .then(modal => {
            modal.onDidDismiss().then((detail: { data: RaceOptions }) => {
              if (detail.data) {
                this.settings.setRaceSettings(detail.data).then(() => {
                  return this.nav.navigateRoot('rms/race');
                });
              }
            });
            return modal.present();
          });
      });
  }

  onExitApp(): void {
    this.alert
      .show({
        message: 'Exit Open Lap?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'OK',
            handler: () => this.exit(),
          },
        ],
      })
      .catch((e: Error) => this.logger.error(e));
  }

  private exit(): void {
    this.logger.info('Exiting application');
    if (this.cu) {
      this.cu
        .disconnect()
        .catch(error => {
          this.logger.error('Error disconnecting from CU:', error);
        })
        .then(() => {
          this.app.exit();
        });
    } else {
      this.app.exit();
    }
    this.logger.info('Exited application');
  }
}
