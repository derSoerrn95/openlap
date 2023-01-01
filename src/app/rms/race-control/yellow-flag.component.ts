import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'yellow-flag',
  styleUrls: ['yellow-flag.component.scss'],
  templateUrl: 'yellow-flag.component.html',
})
export class YellowFlagComponent implements OnChanges {
  @Input() cols: number;

  @Input() rows: number;

  @Input() blink: boolean;

  xOffsets: number[];

  yOffsets: number[];

  radius = 0.4;

  ngOnChanges(_simpleChanges: SimpleChanges): void {
    this.xOffsets = [];
    this.yOffsets = [];
    for (let x = 0; x < this.cols; ++x) {
      this.xOffsets.push(x + 0.5);
    }
    for (let y = 0; y < this.rows; ++y) {
      this.yOffsets.push(y + 0.5);
    }
  }
}
