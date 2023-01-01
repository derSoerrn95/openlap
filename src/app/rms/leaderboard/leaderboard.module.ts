import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { SharedModule } from '../../shared';

import { LeaderboardHeadComponent } from './leaderboard-head.component';
import { LeaderboardItemComponent } from './leaderboard-item.component';
import { LeaderboardComponent } from './leaderboard.component';

@NgModule({
  declarations: [LeaderboardComponent, LeaderboardHeadComponent, LeaderboardItemComponent],
  exports: [LeaderboardComponent],
  imports: [CommonModule, SharedModule],
})
export class LeaderboardModule {}
