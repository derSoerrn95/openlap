import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';

import { AppSettings, Notifications } from '../app-settings';
import { LoggingService, SpeechService } from '../services';

@Component({
  templateUrl: 'notifications.page.html',
})
export class NotificationsPage implements OnInit, OnDestroy {
  items: { id: keyof Notifications; label: string }[] = [
    {
      id: 'finished',
      label: 'Race finished',
    },
    {
      id: 'endsession',
      label: 'Qualifying completed',
    },
    {
      id: 'finallap',
      label: 'Final lap',
    },
    {
      id: 'yellowflag',
      label: 'Yellow flag',
    },
    {
      id: 'greenflag',
      label: 'Track clear',
    },
    {
      id: 'falsestart',
      label: 'False start',
    },
    {
      id: 'newleader',
      label: 'New race leader',
    },
    {
      id: 'bestlap',
      label: 'Fastest lap',
    },
    {
      id: 'bests1',
      label: 'Fastest sector 1',
    },
    {
      id: 'bests2',
      label: 'Fastest sector 2',
    },
    {
      id: 'bests3',
      label: 'Fastest sector 3',
    },
    {
      id: 'fuel2',
      label: 'Fuel < 20%',
    },
    {
      id: 'fuel1',
      label: 'Fuel < 10%',
    },
    {
      id: 'fuel0',
      label: 'No fuel',
    },
    {
      id: 'pitenter',
      label: 'Car enters pit',
    },
    {
      id: 'pitexit',
      label: 'Car leaves pit',
    },
  ];

  notifications: Notifications = {} as Notifications;

  constructor(
    private logger: LoggingService,
    private settings: AppSettings,
    private speech: SpeechService,
    private translate: TranslateService
  ) {
    for (const item of this.items) {
      this.notifications[item.id] = { enabled: false, message: undefined };
    }
  }

  ngOnInit(): void {
    this.settings
      .getNotifications()
      .pipe(take(1))
      .toPromise()
      .then((notifications: Notifications) => {
        this.notifications = notifications;
      })
      .catch(error => {
        this.logger.error('Error getting notifications', error);
      });
  }

  ngOnDestroy(): void {
    this.settings.setNotifications(this.notifications).catch(error => {
      this.logger.error('Error setting notifications', error);
    });
  }

  speak(id: keyof Notifications): void {
    this.getMessage(id).then((message: string) => {
      this.speech.speak(message);
    });
  }

  private getMessage(id: keyof Notifications): Promise<string> {
    if (this.notifications[id]?.message) {
      return Promise.resolve(this.notifications[id].message);
    } else {
      return this.translate.get('notifications.' + id).toPromise();
    }
  }
}
