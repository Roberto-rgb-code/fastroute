import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Kpis, RouteSummary } from '../../core/models';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';
import { ROUTE_BADGE, ROUTE_LABEL } from '../../core/status';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, IconComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  kpis = signal<Kpis | null>(null);
  active = signal<RouteSummary[]>([]);
  loading = signal(true);

  ROUTE_LABEL = ROUTE_LABEL;
  ROUTE_BADGE = ROUTE_BADGE;

  ngOnInit() {
    this.api.kpis().subscribe((k) => this.kpis.set(k));
    this.api.routes().subscribe((r) => {
      this.active.set(r.filter((x) => !['FINISHED', 'CANCELLED'].includes(x.status)).slice(0, 6));
      this.loading.set(false);
    });
  }

  progress(r: RouteSummary): number {
    const total = r._count?.events ?? r.events?.length ?? 0;
    if (!total) return 0;
    const done = (r.events ?? []).filter((e) => e.status === 'COMPLETED').length;
    return Math.round((done / total) * 100);
  }

  get deliveryRate(): number {
    const k = this.kpis();
    if (!k || !k.stopsTotal) return 0;
    return Math.round((k.stopsDelivered / k.stopsTotal) * 100);
  }
}
