import { Injectable } from '@angular/core';
import { AndroidFullScreen } from '@ionic-native/android-full-screen';
import { AppVersion } from '@ionic-native/app-version';
import { Device } from '@ionic-native/device';
import { Insomnia } from '@ionic-native/insomnia';
import { SocialSharing } from '@ionic-native/social-sharing';
import { SplashScreen } from '@ionic-native/splash-screen';
import { StatusBar } from '@ionic-native/status-bar';
import { Platform } from '@ionic/angular';
import { Observable } from 'rxjs';
import { distinctUntilChanged, map, startWith } from 'rxjs/operators';
import { BackButtonEmitter } from '@ionic/angular/providers/platform';

export type DeviceInfo = {
  isVirtual: boolean;
  manufacturer: string;
  model: string;
  platform: string;
  version: string;
};

export enum Orientation {
  Portrait = 'portrait',
  Landscape = 'landscape',
}

@Injectable({
  providedIn: 'root',
})
export class AppService {
  static readonly PORTRAIT = Orientation.Portrait;
  static readonly LANDSCAPE = Orientation.Landscape;

  backButton: BackButtonEmitter;

  orientation: Observable<Orientation>;

  exit: () => void = undefined;

  share: (subject: string, message: string) => Promise<unknown> = undefined;

  constructor(private platform: Platform) {
    this.backButton = platform.backButton;

    // TODO: check if necessary...
    platform.ready().then((readySource: string) => {
      if (readySource === 'cordova') {
        StatusBar.styleDefault();
      }
    });

    if (this.isCordova() && this.isAndroid()) {
      this.exit = () => this.doExit();
    }

    if (this.isCordova() && SocialSharing) {
      this.share = (subject: string, message: string) => this.doShare(subject, message);
    }

    this.orientation = platform.resize.pipe(
      startWith(null as string), // to fix deprecation warning
      map(() => (platform.isPortrait() ? Orientation.Portrait : Orientation.Landscape)),
      distinctUntilChanged()
    );
  }

  async getName(): Promise<string> {
    if (this.isCordova() && AppVersion) {
      await this.platform.ready();
      return AppVersion.getAppName();
    } else {
      return 'App'; // FIXME - generic?
    }
  }

  async getVersion(): Promise<string> {
    if (this.isCordova() && AppVersion) {
      await this.platform.ready();
      return AppVersion.getVersionNumber();
    } else {
      return 'Web';
    }
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    if (this.isCordova() && Device) {
      await this.platform.ready();
      return {
        isVirtual: Device.isVirtual,
        manufacturer: Device.manufacturer,
        model: Device.model,
        platform: Device.platform,
        version: Device.version,
      };
    } else {
      return {
        // TODO: extract info from navigator.userAgent
        isVirtual: false,
        manufacturer: '',
        model: '',
        platform: 'browser',
        version: '',
      };
    }
  }

  async enableFullScreen(value: boolean): Promise<void> {
    if (this.isCordova() && this.isAndroid() && AndroidFullScreen) {
      await this.platform.ready();
      if (value) {
        await AndroidFullScreen.immersiveMode();
      } else {
        await AndroidFullScreen.showSystemUI();
      }
    }
  }

  async hideSplashScreen(): Promise<void> {
    if (this.isCordova() && SplashScreen) {
      await this.platform.ready();
      SplashScreen.hide();
    }
  }

  async keepAwake(value: boolean): Promise<void> {
    if (this.isCordova() && Insomnia) {
      await this.platform.ready();
      if (value) {
        await Insomnia.keepAwake();
      } else {
        await Insomnia.allowSleepAgain();
      }
    }
  }

  isAndroid(): boolean {
    return this.platform.is('android');
  }

  isCordova(): boolean {
    return this.platform.is('cordova');
  }

  private async doShare(subject: string, message: string): Promise<unknown> {
    await this.platform.ready();
    if (SocialSharing) {
      return SocialSharing.shareWithOptions({
        message: message,
        subject: subject,
      });
    }
  }

  private async doExit(): Promise<void> {
    await this.platform.ready();
    if (navigator['app']?.exitApp) {
      navigator['app'].exitApp();
    }
  }
}
