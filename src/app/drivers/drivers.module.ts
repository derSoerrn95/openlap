import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { SharedModule } from '../shared';

import { ColorsPage } from './colors.page';
import { DriversPage } from './drivers.page';

@NgModule({
  declarations: [ColorsPage, DriversPage],
  exports: [ColorsPage, DriversPage],
  imports: [CommonModule, FormsModule, IonicModule, SharedModule],
})
export class DriversModule {}
