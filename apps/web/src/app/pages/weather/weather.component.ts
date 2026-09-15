import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { DEMO_ROUTE_NAME, DEMO_WEATHER } from '../../core/demo.config';
import { RouteSummary, WeatherResult } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { ModulePageComponent } from '../../shared/module-page.component';

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, IconComponent, ModulePageComponent],
  templateUrl: './weather.component.html',
})
export class WeatherComponent implements OnInit {
  private api = inject(ApiService);

  routes = signal<RouteSummary[]>([]);
  routeId = signal('');
  weather = signal<WeatherResult | null>(null);
  loading = signal(false);

  readonly demoLabel = DEMO_WEATHER.label;

  readonly locationLabel = computed(() => {
    const r = this.routes().find((x) => x.id === this.routeId());
    if (r) return r.name;
    return DEMO_WEATHER.label;
  });

  ngOnInit() {
    this.api.routes({ all: true }).subscribe({
      next: (list) => {
        const open = list.filter((r) => !['CANCELLED', 'FINISHED', 'COMPLETED'].includes(r.status));
        this.routes.set(open.length ? open : list.slice(0, 20));
        const demo = open.find((r) => r.name === DEMO_ROUTE_NAME) ?? open[0];
        if (demo) {
          this.routeId.set(demo.id);
          this.onRouteChange(demo.id);
        } else {
          this.loadDemo();
        }
      },
      error: () => this.loadDemo(),
    });
  }

  onRouteChange(id: string) {
    this.routeId.set(id);
    if (!id) {
      this.loadDemo();
      return;
    }
    const r = this.routes().find((x) => x.id === id);
    const ev = r?.events?.find((e) => e.stop);
    if (ev?.stop) {
      this.fetch(ev.stop.lat, ev.stop.lng);
    } else {
      this.loadDemo();
    }
  }

  loadDemo() {
    this.fetch(DEMO_WEATHER.lat, DEMO_WEATHER.lng);
  }

  private fetch(lat: number, lng: number) {
    this.loading.set(true);
    this.api.weather(lat, lng).subscribe({
      next: (w) => {
        this.weather.set(w);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
