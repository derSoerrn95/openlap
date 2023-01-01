import { Component } from '@angular/core';
import { PopoverController } from '@ionic/angular';

import { LoggingService } from '../services';

import { LoggingMenu } from './logging.menu';

@Component({
  templateUrl: 'logging.page.html',
})
export class LoggingPage {
  // FIXME: numeric values of levels are implementation details
  icons = [
    { name: 'bug-sharp', style: { color: 'green' } },
    { name: 'information-circle-sharp', style: { color: 'blue' } },
    { name: 'warning-sharp', style: { color: 'yellow' } },
    { name: 'alert-circle-sharp', style: { color: 'red' } },
  ];

  constructor(public logger: LoggingService, private popover: PopoverController) {}

  showMenu(event: Event): Promise<void> {
    return this.popover
      .create({
        component: LoggingMenu,
        event: event,
      })
      .then(menu => {
        return menu.present();
      });
  }

  stringify(obj: unknown): string {
    if (typeof obj !== 'object' || obj instanceof Error) {
      return obj as string;
    } else {
      try {
        return JSON.stringify(obj, null, ' ');
      } catch (error) {
        return '' + obj;
      }
    }
  }
}
