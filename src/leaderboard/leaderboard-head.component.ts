import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'leaderboard tr[head]',
  templateUrl: 'leaderboard-head.component.html'
})
export class LeaderboardHeadComponent {
  @Input() fields: string[];
}
