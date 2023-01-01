import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';

function createCheckerboardPath(width: number, height: number): string {
  const path = [];
  for (let x = 0; x < width; x += 2) {
    path.push('M', x, ',0V', height, 'H', x + 1, 'V0Z');
  }
  for (let y = 1; y < height; y += 2) {
    path.push('M0,', y, 'H', width, 'V', y + 1, 'H0Z');
  }
  return path.join('');
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'checkerboard',
  styleUrls: ['checkerboard.component.scss'],
  templateUrl: 'checkerboard.component.html',
})
export class CheckerboardComponent implements OnChanges {
  @Input() cols: number;

  @Input() rows: number;

  path: string;

  ngOnChanges(_simpleChange: SimpleChanges): void {
    this.path = createCheckerboardPath(this.cols, this.rows);
  }
}
