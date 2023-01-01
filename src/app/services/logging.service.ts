import { Injectable } from '@angular/core';

export enum LogLevel {
  DEBUG,
  INFO,
  WARNING,
  ERROR,
}

export class LogRecord {
  level: LogLevel; // TODO: as string?
  time: number;
  args: unknown[];
}

@Injectable({
  providedIn: 'root',
})
export class LoggingService {
  private level: LogLevel = LogLevel.INFO;

  private limit = 50; // TODO: config

  // TODO: Observable?
  records = new Array<LogRecord>();

  isDebugEnabled(): boolean {
    return this.level === LogLevel.DEBUG;
  }

  setDebugEnabled(value: boolean): void {
    this.level = value ? LogLevel.DEBUG : LogLevel.INFO;
  }

  debug(...args: unknown[]): void {
    this.log(LogLevel.DEBUG, args);
  }

  info(...args: unknown[]): void {
    this.log(LogLevel.INFO, args);
  }

  warn(...args: unknown[]): void {
    this.log(LogLevel.WARNING, args);
  }

  error(...args: unknown[]): void {
    this.log(LogLevel.ERROR, args);
  }

  clear(): void {
    this.records.length = 0;
  }

  private log(level: LogLevel, args: unknown[]): void {
    if (level >= this.level) {
      while (this.records.length >= this.limit) {
        this.records.shift();
      }
      this.records.push({ level: level, time: Date.now(), args: args });
    }
  }
}
