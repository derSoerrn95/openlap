import { Injectable } from '@angular/core';
import { BLE, BLEScanOptions } from '@ionic-native/ble/ngx';
import { Platform } from '@ionic/angular';
import { EMPTY, from, interval, NextObserver, Observable, Observer, of, Subject, Subscriber } from 'rxjs';
import { distinct, distinctUntilChanged, filter, finalize, map, startWith, switchMap, tap } from 'rxjs/operators';

import { DataView, Peripheral } from '../carrera';
import { LoggingService } from '../services';

import { Backend } from './backend';
import { AnonymousSubject } from 'rxjs/internal-compatibility';

const SERVICE_UUID = '39df7777-b1b4-b90b-57f1-7144ae4e4a6a';
const OUTPUT_UUID = '39df8888-b1b4-b90b-57f1-7144ae4e4a6a';
const NOTIFY_UUID = '39df9999-b1b4-b90b-57f1-7144ae4e4a6a';

const DOLLAR = '$'.charCodeAt(0);

function bufferToString(buffer: ArrayBuffer): string {
  // TODO: special DataView.convertToString() method?
  return new DataView(buffer).toString();
}

class BLEPeripheral implements Peripheral {
  type = 'ble';

  name: string;

  address: string;

  lastWritten: string;

  constructor(device: BluetoothDevice, private ble: BLE, private logger: LoggingService) {
    this.name = device.name;
    this.address = device.id;
  }

  connect(connected?: NextObserver<void>, disconnected?: NextObserver<void>): Subject<ArrayBuffer> {
    const observable = this.createObservable(connected, disconnected);
    const observer = this.createObserver(disconnected);
    return new AnonymousSubject(observer, observable);
  }

  equals(other: Peripheral): boolean {
    return other && other.type === this.type && other.address === this.address;
  }

  private createObservable(connected?: NextObserver<void>, disconnected?: NextObserver<void>): Observable<ArrayBuffer> {
    return new Observable<ArrayBuffer>((subscriber: Subscriber<ArrayBuffer>) => {
      this.logger.info('Connecting to BLE device ' + this.address);
      let isConnected: boolean = false;
      let lastReceived: string;
      this.lastWritten = null;
      this.ble.connect(this.address).subscribe({
        next: (peripheral: Peripheral) => {
          this.logger.info('Connected to BLE device', peripheral);
          isConnected = true;
          this.ble.startNotification(this.address, SERVICE_UUID, NOTIFY_UUID).subscribe({
            next: ([data, _]: [ArrayBuffer, unknown]) => {
              if (this.logger.isDebugEnabled()) {
                const s: string = bufferToString(data);
                if (s !== lastReceived) {
                  this.logger.debug('BLE received ' + s);
                  lastReceived = s;
                }
              }
              this.onNotify(data, subscriber);
            },
            error: (err: Error) => this.onError(err, subscriber),
          });
          if (connected) {
            // this should resolve *after* this.ble.startNotification is installed
            this.ble
              .isConnected(this.address)
              .then(() => {
                this.logger.info('BLE device ready');
                if (isConnected) {
                  connected.next(undefined);
                }
              })
              .catch((err: Error) => {
                this.logger.error('BLE device not connected', err);
              });
          }
        },
        error: (obj: Error) => {
          if (obj instanceof Error) {
            this.logger.error('BLE connection error', obj);
            subscriber.error(obj);
          } else if (!isConnected) {
            this.logger.error('BLE connection error', obj);
            subscriber.error(new Error('Connection error'));
          } else {
            this.logger.info('BLE device disconnected', obj);
            subscriber.complete();
          }
          isConnected = false;
        },
        complete: () => {
          this.logger.info('BLE connection closed');
          subscriber.complete();
          isConnected = false;
        },
      });
      return () => {
        this.disconnect(disconnected);
      };
    });
  }

  private createObserver(disconnected?: NextObserver<void>): Observer<ArrayBuffer> {
    return {
      next: (value: ArrayBuffer) => {
        if (this.logger.isDebugEnabled()) {
          const s: string = bufferToString(value);
          if (s !== this.lastWritten) {
            this.logger.debug('BLE write ' + s);
            this.lastWritten = s;
          }
        }
        this.write(value);
      },
      error: (err: Error) => this.logger.error('BLE user error', err),
      complete: () => this.disconnect(disconnected),
    };
  }

  private write(value: ArrayBuffer): void {
    this.ble.writeWithoutResponse(this.address, SERVICE_UUID, OUTPUT_UUID, value).catch(error => {
      this.logger.error('BLE write error', error);
    });
  }

  private disconnect(disconnected?: NextObserver<void>): void {
    this.logger.debug('Closing BLE connection to ' + this.address);
    this.ble
      .disconnect(this.address)
      .then(() => {
        this.logger.info('BLE disconnected from ' + this.address);
      })
      .catch(error => {
        this.logger.error('BLE disconnect error', error);
      })
      .then(() => {
        if (disconnected) {
          disconnected.next(undefined);
        }
      });
  }

  // TODO: think about abstract class and put logic in there
  private onNotify(data: ArrayBuffer, subscriber: Subscriber<ArrayBuffer>): void {
    // strip trailing '$' and prepend missing '0'/'?' for notifications
    // TODO: only handle version specially and drop '?'?
    const view = new Uint8Array(data);
    if (view[view.length - 1] === DOLLAR) {
      view.copyWithin(1, 0);
      view[0] = view.length === 6 ? 0x30 : 0x3f;
    }
    subscriber.next(view.buffer);
  }

  private onError(error: Error, subscriber: Subscriber<ArrayBuffer>): void {
    subscriber.error(error);
  }
}

@Injectable()
export class BLEBackend extends Backend {
  private scanner: Observable<string>;

  private devices = new Map<string, BluetoothDevice>();

  constructor(private ble: BLE, private logger: LoggingService, private platform: Platform) {
    super();

    this.scanner = from(this.platform.ready()).pipe(
      switchMap((readySource: string) => {
        if (readySource === 'cordova') {
          // TODO: use BLE state listeners when available in ionic-native?
          return interval(1000).pipe(
            startWith(null as string), // to fix deprecation warning
            switchMap(() => {
              return from(
                this.ble.isEnabled().then(
                  () => true,
                  () => false
                )
              );
            })
          );
        } else {
          return of(false);
        }
      }),
      distinctUntilChanged(),
      switchMap((enabled: boolean) => {
        if (enabled) {
          this.logger.info('Start scanning for BLE devices');
          return this.ble
            .startScanWithOptions([], {
              reportDuplicates: true,
              scanMode: 'lowLatency',
            } as BLEScanOptions)
            .pipe(finalize(() => this.logger.info('Stop scanning for BLE devices')));
        } else {
          this.logger.info('Not scanning for BLE devices');
          return EMPTY;
        }
      })
    );
  }

  scan(): Observable<BLEPeripheral> {
    return this.scanner.pipe(
      startWith(...this.devices.values()),
      distinct((device: BluetoothDevice) => device.id),
      tap((device: BluetoothDevice) => this.logger.debug('Discovered BLE device:', device)),
      filter(device => /Control.Unit/i.test(device.name || '')),
      tap((device: BluetoothDevice) => this.logger.info('Discovered Control Unit device:', device)),
      tap((device: BluetoothDevice) => this.devices.set(device.id, device)),
      tap((_: BluetoothDevice) => this.logger.debug('Cached devices:', Array.from(this.devices.values()))),
      map((device: BluetoothDevice) => new BLEPeripheral(device, this.ble, this.logger))
    );
  }
}
