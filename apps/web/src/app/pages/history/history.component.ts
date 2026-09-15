import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Driver, RouteSummary } from '../../core/models';
import { ROUTE_BADGE, ROUTE_LABEL } from '../../core/status';
import { IconComponent } from '../../shared/icon.component';
import { ModulePageComponent } from '../../shared/module-page.component';

/** Historial operativo: rutas cerradas (finalizadas/canceladas) con filtros y timeline. */
@Component({
  selector: 'app-history',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, IconComponent, ModulePageComponent],
  templateUrl: './history.component.html',
})
export class HistoryComponent implements OnInit {
  private api = inject(ApiService);

  readonly ROUTE_LABEL = ROUTE_LABEL;
  readonly ROUTE_BADGE = ROUTE_BADGE;

  rows = signal<RouteSummary[]>([]);
  drivers = signal<Driver[]>([]);
  loading = signal(true);

  from = signal(this.daysAgo(30));
  to = signal(this.today());
  driverId = signal('');
  q = signal('');

  readonly stats = computed(() => {
    const rs = this.rows();
    const finished = rs.filter((r) => r.status === 'FINISHED' || r.status === 'COMPLETED').length;
    const cancelled = rs.filter((r) => r.status === 'CANCELLED').length;
    const km = rs.reduce((a, r) => a + (r.totalDistance ?? 0) / 1000, 0);
    return { total: rs.length, finished, cancelled, km };
  });

  ngOnInit() {
    this.api.drivers().subscribe({ next: (d) => this.drivers.set(d), error: () => null });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api
      .routesHistory({
        from: this.from(),
        to: this.to(),
        driverId: this.driverId() || undefined,
        q: this.q().trim() || undefined,
      })
      .subscribe({
        next: (r) => {
          this.rows.set(r);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  stopsDone(r: RouteSummary): number {
    return (r.events ?? []).filter((e) => e.status === 'COMPLETED').length;
  }
  stopsTotal(r: RouteSummary): number {
    return r._count?.events ?? r.events?.length ?? 0;
  }

  tonePill(status: string): string {
    switch (ROUTE_BADGE[status]) {
      case 'ok':
        return 'bg-ok-bg text-ok';
      case 'warn':
        return 'bg-warn-bg text-warn';
      case 'danger':
        return 'bg-danger-bg text-danger';
      case 'info':
        return 'bg-info-bg text-info';
      default:
        return 'bg-ink-100 text-ink-500';
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
  private daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
}
