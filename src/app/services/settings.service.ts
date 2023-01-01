import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { Observable, ReplaySubject } from 'rxjs';
import { Connection } from '../app-settings';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private subjects = new Map<string, ReplaySubject<unknown>>();

  constructor(private storage: Storage) {}

  async createDB(): Promise<Storage> {
    return this.storage.create();
  }

  async clear(): Promise<void> {
    await this.storage.clear();
    this.subjects.forEach((subject: ReplaySubject<Connection>) => subject.next(undefined));
  }

  async get(key: string): Promise<unknown> {
    return await this.storage.get(key);
  }

  observe(key: string): Observable<unknown> {
    let subject = this.subjects.get(key);
    if (!subject) {
      subject = new ReplaySubject<unknown>(1);
      this.subjects.set(key, subject);
      this.storage
        .get(key)
        .then(value => {
          subject.next(value);
        })
        .catch(error => {
          subject.error(error);
        });
    }
    return subject.asObservable();
  }

  async remove(key: string): Promise<void> {
    await this.storage.remove(key);
    const subject = this.subjects.get(key);
    if (subject) {
      subject.next(undefined);
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.storage.set(key, value);
    const subject = this.subjects.get(key);
    if (subject) {
      subject.next(value);
    }
  }
}
