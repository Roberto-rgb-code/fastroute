import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { RouteSummary, RouteStatus } from '../../core/models';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';
import { ROUTE_BADGE, ROUTE_LABEL } from '../../core/status';

@Component({
  selector: 'app-routes-list',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, IconComponent],
  templateUrl: './routes-list.component.html',
  styleUrl: './routes-list.component.scss',
})
export class RoutesListComponent implements OnInit {
  private api = inject(ApiService);
  routes = signal<RouteSummary[]>([]);
  loading = signal(true);
  filter = signal<RouteStatus | 'ALL'>('ALL');

  ROUTE_LABEL = ROUTE_LABEL;
  ROUTE_BADGE = ROUTE_BADGE;

  filters: { key: RouteStatus | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'Todas' },
    { key: 'PENDING', label: 'Pendientes' },
    { key: 'ENROUTE', label: 'En ruta' },
    { key: 'COMPLETED', label: 'Completadas' },
    { key: 'FINISHED', label: 'Finalizadas' },
  ];

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.routes().subscribe((r) => {
      this.routes.set(r);
      this.loading.set(false);
    });
  }

  setFilter(f: RouteStatus | 'ALL') {
    this.filter.set(f);
  }

  get visible(): RouteSummary[] {
    const f = this.filter();
    if (f === 'ALL') return this.routes();
    return this.routes().filter((r) => r.status === f);
  }

  progress(r: RouteSummary): number {
    const total = r._count?.events ?? r.events?.length ?? 0;
    if (!total) return 0;
    const done = (r.events ?? []).filter((e) => e.status === 'COMPLETED').length;
    return Math.round((done / total) * 100);
  }

  km(m?: number): string {
    return m ? (m / 1000).toFixed(1) + ' km' : '—';
  }
}
