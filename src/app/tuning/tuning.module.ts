import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { SharedModule } from '../shared';

import { TuningMenu } from './tuning.menu';
import { TuningPage } from './tuning.page';

@NgModule({
  declarations: [TuningMenu, TuningPage],
  exports: [TuningPage],
  imports: [CommonModule, FormsModule, IonicModule, SharedModule],
})
export class TuningModule {}
