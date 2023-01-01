import { NextObserver, Subject } from 'rxjs';
import { Connection } from '../app-settings';

export interface Peripheral {
  type: string; // 'ble' | 'serial' | 'demo';
  name: string;
  address?: string;

  connect(connected?: NextObserver<void>, disconnected?: NextObserver<void>): Subject<ArrayBuffer>;

  equals(other: Peripheral | Connection | BluetoothDevice): boolean;
}
