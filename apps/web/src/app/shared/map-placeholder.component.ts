import { Component, Input } from '@angular/core';
import { Stop } from '../core/models';
import { MapPoint, RouteMapComponent } from './route-map.component';

/** Alias legado: ahora siempre renderiza Mapbox vía app-route-map. */
@Component({
  selector: 'app-map-placeholder',
  standalone: true,
  imports: [RouteMapComponent],
  template: `<app-route-map [points]="mapPoints" />`,
  styles: [':host{display:block;height:100%;width:100%;min-height:260px}'],
})
export class MapPlaceholderComponent {
  @Input() set stops(value: Stop[]) {
    this._stops = value ?? [];
    this.mapPoints = this._stops.map((s, i) => ({
      lat: s.lat,
      lng: s.lng,
      label: s.label,
      color: '#4f46e5',
      index: i + 1,
    }));
  }
  private _stops: Stop[] = [];
  mapPoints: MapPoint[] = [];
}
