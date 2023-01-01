import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';

import { AppRoutingModule } from '../app-routing.module';
import { SharedModule } from '../shared';

import { ConnectionsComponent } from './connections.component';
import { CuVersionPipe } from './cu-version.pipe';
import { MenuComponent } from './menu.component';

@NgModule({
  declarations: [ConnectionsComponent, CuVersionPipe, MenuComponent],
  exports: [MenuComponent],
  imports: [CommonModule, SharedModule, IonicModule, AppRoutingModule],
})
export class MenuModule {}
