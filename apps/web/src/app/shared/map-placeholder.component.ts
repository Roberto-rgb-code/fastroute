import { Component, Input } from '@angular/core';
import { Stop } from '../core/models';

/** SVG fallback map when no Mapbox token is configured. Plots stops normalized. */
@Component({
  selector: 'app-map-placeholder',
  standalone: true,
  template: `
    <div class="ph-map">
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="260" fill="#e8eef5" />
        @for (i of grid; track i) {
          <line [attr.x1]="i * 40" y1="0" [attr.x2]="i * 40" y2="260" stroke="#d5dfe9" />
          <line x1="0" [attr.y1]="i * 40" x2="400" [attr.y2]="i * 40" stroke="#d5dfe9" />
        }
        <polyline
          [attr.points]="line"
          fill="none"
          stroke="#6366f1"
          stroke-width="3"
          stroke-linejoin="round"
        />
        @for (p of points; track $index) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="9" fill="#4f46e5" stroke="#fff" stroke-width="2" />
          <text [attr.x]="p.x" [attr.y]="p.y + 3.5" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">
            {{ $index + 1 }}
          </text>
        }
      </svg>
      <span class="tag">Demo · configura MAPBOX_ACCESS_TOKEN para mapa real</span>
    </div>
  `,
  styles: [
    `
      .ph-map {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 260px;
        border-radius: var(--radius);
        overflow: hidden;
      }
      svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .tag {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(15, 23, 42, 0.75);
        color: #fff;
        font-size: 0.68rem;
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
      }
    `,
  ],
})
export class MapPlaceholderComponent {
  @Input() set stops(value: Stop[]) {
    this._stops = value ?? [];
    this.compute();
  }
  private _stops: Stop[] = [];
  grid = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  points: { x: number; y: number }[] = [];
  line = '';

  private compute() {
    if (!this._stops.length) {
      this.points = [];
      this.line = '';
      return;
    }
    const lats = this._stops.map((s) => s.lat);
    const lngs = this._stops.map((s) => s.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = maxLat - minLat || 1;
    const spanLng = maxLng - minLng || 1;
    this.points = this._stops.map((s) => ({
      x: 40 + ((s.lng - minLng) / spanLng) * 320,
      y: 40 + (1 - (s.lat - minLat) / spanLat) * 180,
    }));
    this.line = this.points.map((p) => `${p.x},${p.y}`).join(' ');
  }
}
