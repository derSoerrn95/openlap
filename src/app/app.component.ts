import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { TranslateService } from '@ngx-translate/core';
import { from, Observable, Subscription } from 'rxjs';
import { first, mergeMap, timeout } from 'rxjs/operators';

import { AppSettings, Connection } from './app-settings';
import { Backend } from './backend';
import { ControlUnit, Peripheral } from './carrera';
import { AppService, ControlUnitService, I18nAlertService, I18nToastService, LoggingService, SpeechService } from './services';

const CONNECTION_TIMEOUT: number = 3000;

const STATE_MESSAGES: { connected: string; connecting: string; disconnected: string } = {
  connected: 'Connected to {{device}}',
  connecting: 'Connecting to {{device}}',
  disconnected: 'Disconnected from {{device}}',
};

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
})
export class AppComponent implements OnInit, OnDestroy {
  private stateSubscription: Subscription = new Subscription();

  constructor(
    private app: AppService,
    public cu: ControlUnitService,
    @Inject(Backend) private backends: Backend[],
    private alert: I18nAlertService,
    private logger: LoggingService,
    private settings: AppSettings,
    private speech: SpeechService,
    private toast: I18nToastService,
    private translate: TranslateService,
    private updates: SwUpdate
  ) {
    // enable/disable fullscreen mode based on screen orientation, *not* WebView orientation
    window.addEventListener('orientationchange', () => {
      app.enableFullScreen(window.screen.orientation.type.startsWith('landscape')).catch((e: Error) => this.logger.error(e));
    });
    if (window.screen.orientation?.type) {
      app.enableFullScreen(window.screen.orientation.type.startsWith('landscape')).catch((e: Error) => this.logger.error(e));
    }
    app.keepAwake(true).catch((e: Error) => this.logger.error(e));
    translate.setDefaultLang('en');
  }

  ngOnInit(): void {
    this.settings.create().then(() => {
      this.settings.getOptions().subscribe(options => {
        this.logger.setDebugEnabled(options.debug);
        this.setLanguage(options.language);
      });
      this.settings.getConnection().subscribe((connection: Connection) => {
        this.stateSubscription.unsubscribe();
        if (connection?.name) {
          this.logger.info('Connecting to ' + connection.name);
          // TODO: scan only backend responsible for this connection? provide backend.get()?
          from(this.backends.map(backend => backend.scan()))
            .pipe(
              mergeMap((device: Observable<Peripheral>) => device),
              first((device: Peripheral) => device.equals(connection)),
              timeout(CONNECTION_TIMEOUT)
            )
            .toPromise()
            .then((device: Peripheral) => {
              const cu = new ControlUnit(device, connection);
              this.stateSubscription = cu.getState().subscribe(state => this.showConnectionToast(state, cu.peripheral.name));
              this.cu.next(cu);
              return cu.connect();
            })
            .catch(error => {
              this.logger.error('Error connecting to ' + connection.name + ':', error);
            })
            .then(() => {
              return this.app.hideSplashScreen();
            });
        } else {
          this.app.hideSplashScreen().catch((e: Error) => this.logger.error(e));
          this.cu.next(null);
        }
      });
      // TODO: wait for app becoming stable
      if (this.updates.isEnabled) {
        this.logger.info('Service worker enabled');
        this.updates.versionUpdates.subscribe(() => {
          this.logger.info('Update available');
          this.update();
        });
      } else {
        this.logger.debug('Service worker not enabled');
      }
    });
  }

  ngOnDestroy(): void {
    this.cu.next(null);
  }

  private update(): void {
    this.alert
      .show({
        message: 'A new version of Open Lap is available. Do you want to update now?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'OK',
            handler: () => document.location.reload(),
          },
        ],
      })
      .catch((e: Error) => this.logger.error(e));
  }

  private setLanguage(language: string): void {
    this.translate
      .use(language || this.translate.getBrowserLang() || 'en')
      .toPromise()
      .then(_ => {
        this.translate
          .get('notifications.locale')
          .toPromise()
          .then(locale => {
            this.speech.setLocale(locale);
          });
      });
  }

  private showConnectionToast(state: string, device: string): void {
    const message = STATE_MESSAGES[state] || 'Connecting to {{device}}';
    this.toast.showShortCenter(message, { device: device }).catch(error => {
      this.logger.error('Error showing toast', error);
    });
  }
}
