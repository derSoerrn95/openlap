/// <reference types="web-bluetooth" />

import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { EMPTY, from, NextObserver, Observable, Observer, Subject, Subscriber } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

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

class WebBluetoothPeripheral implements Peripheral {
  type = 'web-bluetooth';

  name: string;

  output: Promise<BluetoothRemoteGATTCharacteristic>;

  lastWritten: string;

  constructor(private device: BluetoothDevice, private logger: LoggingService) {
    this.name = device.name;
  }

  connect(connected?: NextObserver<void>, disconnected?: NextObserver<void>): Subject<ArrayBuffer> {
    const observable = this.createObservable(connected, disconnected);
    const observer = this.createObserver(disconnected);
    return new AnonymousSubject(observer, observable);
  }

  equals(other: Peripheral): boolean {
    return other && other.type === this.type;
  }

  private createObservable(connected?: NextObserver<void>, disconnected?: NextObserver<void>): Observable<ArrayBuffer> {
    return new Observable<ArrayBuffer>((subscriber: Subscriber<ArrayBuffer>) => {
      this.logger.info('Connecting to Web Bluetooth device ' + this.device.id);
      const service: Promise<BluetoothRemoteGATTService> = this.device.gatt.connect().then((server: BluetoothRemoteGATTServer) => {
        return server.getPrimaryService(SERVICE_UUID);
      });
      const notify: Promise<BluetoothRemoteGATTCharacteristic> = service.then((s: BluetoothRemoteGATTService) =>
        s.getCharacteristic(NOTIFY_UUID)
      );
      const eventListener: EventListenerOrEventListenerObject = (event: Event & { target: BluetoothRemoteGATTCharacteristic }) => {
        const data = event.target.value.buffer;
        if (this.logger.isDebugEnabled()) {
          const s: string = bufferToString(data);
          if (s !== lastReceived) {
            this.logger.debug('Web Bluetooth received ' + s);
            lastReceived = s;
          }
        }
        this.onNotify(data, subscriber);
      };
      let lastReceived: string = null;
      this.lastWritten = null;
      this.output = service.then((s: BluetoothRemoteGATTService) => s.getCharacteristic(OUTPUT_UUID));
      notify
        .then((characteristic: BluetoothRemoteGATTCharacteristic) => {
          return characteristic.startNotifications().then((_: BluetoothRemoteGATTCharacteristic) => characteristic);
        })
        .then((characteristic: BluetoothRemoteGATTCharacteristic) => {
          characteristic.addEventListener('characteristicvaluechanged', eventListener);
          this.logger.info('Web Bluetooth device ready');
          if (connected) {
            connected.next(undefined);
          }
        })
        .catch(error => {
          this.onError(error, subscriber);
        });
      return () => {
        notify
          .then((characteristic: BluetoothRemoteGATTCharacteristic) => {
            return characteristic.stopNotifications().then((_: BluetoothRemoteGATTCharacteristic) => characteristic);
          })
          .then((characteristic: BluetoothRemoteGATTCharacteristic) => {
            characteristic.removeEventListener('characteristicvaluechanged', eventListener);
          })
          .catch((error: Error) => {
            this.logger.error('Error stopping Web Bluetooth notifications', error);
          })
          .then(_ => {
            this.disconnect(disconnected);
          });
      };
    });
  }

  private createObserver(disconnected?: NextObserver<void>): Observer<ArrayBuffer> {
    return {
      next: (value: ArrayBuffer) => {
        if (this.device.gatt.connected && this.output) {
          if (this.logger.isDebugEnabled()) {
            const s: string = bufferToString(value);
            if (s !== this.lastWritten) {
              this.logger.debug('Web Bluetooth write ' + s);
              this.lastWritten = s;
            }
          }
          this.output
            .then((characteristic: BluetoothRemoteGATTCharacteristic) => {
              return characteristic.writeValue(value);
            })
            .catch((error: Error) => {
              this.logger.error('Web Bluetooth write error', error);
            });
        } else {
          this.logger.error('Web Bluetooth write while device disconnected');
        }
      },
      error: (err: Error) => this.logger.error('Web Bluetooth user error', err),
      complete: () => this.disconnect(disconnected),
    };
  }

  private disconnect(disconnected?: NextObserver<void>): void {
    if (this.device.gatt.connected) {
      this.logger.debug('Closing Web Bluetooth connection to ' + this.device.id);
      try {
        this.device.gatt.disconnect();
      } catch (error) {
        this.logger.debug('Error closing Web Bluetooth connection', error);
      }
      this.output = null;
      if (disconnected) {
        disconnected.next(undefined);
      }
    }
  }

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
export class WebBluetoothBackend extends Backend {
  private navigator: Navigator = window.navigator;

  private device: Promise<WebBluetoothPeripheral>;

  constructor(private logger: LoggingService, private platform: Platform) {
    super();
  }

  scan(): Observable<WebBluetoothPeripheral> {
    return from(this.platform.ready()).pipe(
      switchMap((readySource: string) => {
        if (readySource !== 'cordova' && this.navigator.bluetooth) {
          return from(this.requestDevice()).pipe(
            catchError(err => {
              this.logger.error('Error requesting Web Bluetooth device:', err);
              return EMPTY;
            })
          );
        } else {
          return EMPTY;
        }
      })
    );
  }

  private requestDevice(): Promise<WebBluetoothPeripheral> {
    if (this.device) {
      return this.device; // avoid multiple pop-up dialogs
    } else {
      return this.navigator.bluetooth
        .requestDevice({
          filters: [{ name: 'Control_Unit' }],
          optionalServices: [SERVICE_UUID],
        })
        .then((device: BluetoothDevice) => {
          const p = new WebBluetoothPeripheral(device, this.logger);
          this.device = Promise.resolve(p);
          return p;
        });
    }
  }
}
