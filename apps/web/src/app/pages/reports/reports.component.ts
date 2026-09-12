import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Incident, OperationsReport, StopsReport } from '../../core/models';
import {
  DELIVER_BADGE,
  DELIVER_LABEL,
  EVENT_BADGE,
  EVENT_LABEL,
  INCIDENT_LABEL,
  ROUTE_BADGE,
  ROUTE_LABEL,
  STOP_TYPE_LABEL,
} from '../../core/status';
import { IconComponent } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

type Tab = 'stops' | 'operations' | 'incidents';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule, RouterLink, PageHeaderComponent, IconComponent, DecimalPipe],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  private api = inject(ApiService);

  tab = signal<Tab>('stops');
  from = '';
  to = '';
  loading = signal(false);
  stops = signal<StopsReport | null>(null);
  ops = signal<OperationsReport | null>(null);
  incidents = signal<Incident[]>([]);

  readonly ROUTE_LABEL = ROUTE_LABEL;
  readonly ROUTE_BADGE = ROUTE_BADGE;
  readonly EVENT_LABEL = EVENT_LABEL;
  readonly EVENT_BADGE = EVENT_BADGE;
  readonly DELIVER_LABEL = DELIVER_LABEL;
  readonly DELIVER_BADGE = DELIVER_BADGE;
  readonly STOP_TYPE_LABEL = STOP_TYPE_LABEL;
  readonly INCIDENT_LABEL = INCIDENT_LABEL;

  tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'stops', label: 'Paradas', icon: 'pin' },
    { key: 'operations', label: 'Operaciones', icon: 'route' },
    { key: 'incidents', label: 'Incidencias', icon: 'alert' },
  ];

  ngOnInit() {
    this.api.today().subscribe((t) => {
      this.from = this.to = t.day;
      this.run();
    });
  }

  preset(kind: 'today' | 'yesterday' | 'week' | 'month') {
    const [y, m, d] = this.to.split('-').map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    const iso = (dt: Date) => dt.toISOString().slice(0, 10);
    switch (kind) {
      case 'today':
        this.from = this.to;
        break;
      case 'yesterday': {
        const yd = new Date(base.getTime() - 86400000);
        this.from = this.to = iso(yd);
        break;
      }
      case 'week':
        this.from = iso(new Date(base.getTime() - 6 * 86400000));
        break;
      case 'month':
        this.from = iso(new Date(Date.UTC(y, m - 1, 1)));
        break;
    }
    this.run();
  }

  run() {
    this.loading.set(true);
    const done = () => this.loading.set(false);
    switch (this.tab()) {
      case 'stops':
        this.api.reportStops(this.from, this.to).subscribe({ next: (r) => { this.stops.set(r); done(); }, error: done });
        break;
      case 'operations':
        this.api.reportOperations(this.from, this.to).subscribe({ next: (r) => { this.ops.set(r); done(); }, error: done });
        break;
      case 'incidents':
        this.api.incidents(this.to).subscribe({ next: (r) => { this.incidents.set(r); done(); }, error: done });
        break;
    }
  }

  setTab(t: Tab) {
    this.tab.set(t);
    this.run();
  }

  exportCsv() {
    let rows: Record<string, unknown>[] = [];
    let name = 'reporte';
    if (this.tab() === 'stops' && this.stops()) {
      rows = this.stops()!.rows as unknown as Record<string, unknown>[];
      name = `paradas_${this.from}_${this.to}`;
    } else if (this.tab() === 'operations' && this.ops()) {
      rows = this.ops()!.rows as unknown as Record<string, unknown>[];
      name = `operaciones_${this.from}_${this.to}`;
    } else if (this.tab() === 'incidents') {
      rows = this.incidents().map((i) => ({
        fecha: i.createdAt,
        ruta: i.route?.name,
        operador: i.route?.driver?.name,
        motivo: INCIDENT_LABEL[i.reason],
        comentario: i.comment,
        fotos: i.photos.length,
        lat: i.lat,
        lng: i.lng,
      }));
      name = `incidencias_${this.to}`;
    }
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  pct(n: number, total: number) {
    return total ? Math.round((n / total) * 100) : 0;
  }
  time(d?: string | null) {
    return d ? new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }) : '—';
  }
  dateTime(d?: string | null) {
    return d
      ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })
      : '—';
  }
  money(n: number) {
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
