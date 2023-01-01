import { Component, Inject, Input, OnDestroy, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { EMPTY, from, Observable, Subscription } from 'rxjs';
import { catchError, filter, mergeMap, scan, take, tap } from 'rxjs/operators';

import { AppSettings, Connection } from '../app-settings';
import { Backend } from '../backend';
import { Peripheral } from '../carrera';
import { I18nToastService, LoggingService } from '../services';

@Component({
  selector: 'connections',
  templateUrl: 'connections.component.html',
})
export class ConnectionsComponent implements OnInit, OnDestroy {
  @Input() selected: Peripheral;

  peripherals: Observable<Peripheral[]>;

  private demoControlUnit = false;

  private subscription: Subscription = new Subscription();

  constructor(
    @Inject(Backend) private backends: Backend[],
    private logger: LoggingService,
    private platform: Platform,
    private settings: AppSettings,
    private toast: I18nToastService
  ) {}

  ngOnInit(): void {
    this.platform.ready().then(() => {
      const scans = this.backends.map(backend =>
        backend.scan().pipe(
          catchError(e => {
            this.logger.error('Scan error:', e);
            this.toast.showLongCenter(e.toString()).catch((e: Error) => this.logger.error(e)); // TODO: key with param?
            return EMPTY;
          })
        )
      );
      this.peripherals = from(scans).pipe(
        mergeMap(value => value),
        filter(device => {
          return device.type !== 'demo' || this.demoControlUnit;
        }),
        tap(device => {
          // automatically connect to first paired Web-Bluetooth device
          if (!this.selected && device.type === 'web-bluetooth') {
            this.onSelect(device);
          }
        }),
        scan((result, device) => {
          return result.concat(device);
        }, [])
      );
    });
    this.subscription.add(
      this.settings.getConnection().subscribe((value: Connection) => {
        this.demoControlUnit = value.demoControlUnit;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onSelect(peripheral: Peripheral): void {
    this.settings
      .getConnection()
      .pipe(take(1))
      .subscribe((connection: Connection) => {
        this.settings
          .setConnection(
            Object.assign({}, connection, {
              type: peripheral.type,
              name: peripheral.name,
              address: peripheral.address,
            })
          )
          .catch((e: Error) => this.logger.error(e));
      });
  }
}
