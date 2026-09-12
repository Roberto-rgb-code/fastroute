import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DashboardSeries, Kpis, RouteSummary, TERMINAL_ROUTE_STATUSES } from '../../core/models';
import { ROUTE_BADGE, ROUTE_LABEL } from '../../core/status';
import { ChartComponent } from '../../shared/chart.component';
import { IconComponent } from '../../shared/icon.component';

type Period = 7 | 14 | 30;

const BLUE = '#2563eb';
const BLUE_LIGHT = '#93c5fd';
const BLUE_SOFT = 'rgba(37, 99, 235, 0.12)';
const GREEN = '#059669';
const RED = '#dc2626';
const AMBER = '#f59e0b';
const INK = '#0f172a';
const GRID = '#eef2f7';

function sparkline(values: number[], color: string): ChartConfiguration {
  return {
    type: 'line',
    data: {
      labels: values.map((_, i) => i),
      datasets: [
        {
          data: values,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.45,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: { tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      layout: { padding: 2 },
    },
  };
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, IconComponent, ChartComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  kpis = signal<Kpis | null>(null);
  series = signal<DashboardSeries | null>(null);
  active = signal<RouteSummary[]>([]);
  loading = signal(true);
  period = signal<Period>(14);
  barMode = signal<'stops' | 'routes'>('stops');

  ROUTE_LABEL = ROUTE_LABEL;
  ROUTE_BADGE = ROUTE_BADGE;
  readonly periods: Period[] = [7, 14, 30];
  readonly weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  /** Franjas de 2 horas de 6:00 a 22:00 (horario operativo típico). */
  readonly hourBuckets = [6, 8, 10, 12, 14, 16, 18, 20];

  firstName = computed(() => (this.auth.user()?.name ?? 'equipo').split(' ')[0]);

  // ───── KPI sparklines ─────
  sparkRoutes = computed(() => sparkline(this.series()?.daily.map((d) => d.routes) ?? [], BLUE));
  sparkDelivered = computed(() => sparkline(this.series()?.daily.map((d) => d.delivered) ?? [], GREEN));
  sparkKm = computed(() => sparkline(this.series()?.daily.map((d) => d.km) ?? [], BLUE));
  sparkExpenses = computed(() => sparkline(this.series()?.daily.map((d) => d.expenses) ?? [], AMBER));

  // ───── Barras "Resumen de entregas" (estilo Sales Overview) ─────
  barsConfig = computed<ChartConfiguration>(() => {
    const s = this.series();
    const daily = s?.daily ?? [];
    const labels = daily.map((d) => this.shortDay(d.day));
    const stopsMode = this.barMode() === 'stops';
    return {
      type: 'bar',
      data: {
        labels,
        datasets: stopsMode
          ? [
              { label: 'Entregadas', data: daily.map((d) => d.delivered), backgroundColor: BLUE, borderRadius: 6, borderSkipped: false, maxBarThickness: 14 },
              { label: 'Paradas totales', data: daily.map((d) => d.stops), backgroundColor: BLUE_LIGHT, borderRadius: 6, borderSkipped: false, maxBarThickness: 14 },
            ]
          : [
              { label: 'Completadas', data: daily.map((d) => d.completed), backgroundColor: BLUE, borderRadius: 6, borderSkipped: false, maxBarThickness: 14 },
              { label: 'Rutas', data: daily.map((d) => d.routes), backgroundColor: BLUE_LIGHT, borderRadius: 6, borderSkipped: false, maxBarThickness: 14 },
              { label: 'Canceladas', data: daily.map((d) => d.cancelled), backgroundColor: '#fca5a5', borderRadius: 6, borderSkipped: false, maxBarThickness: 14 },
            ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 6, padding: 16 } },
          tooltip: {
            displayColors: true,
            callbacks: { title: (items) => (items[0] ? this.longDay(daily[items[0].dataIndex]?.day) : '') },
          },
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 15 } },
          y: { beginAtZero: true, grid: { color: GRID }, border: { display: false, dash: [4, 4] }, ticks: { precision: 0, padding: 8 } },
        },
      },
    };
  });

  // ───── Dona "Resultado de paradas" (estilo Earning report) ─────
  donutConfig = computed<ChartConfiguration>(() => {
    const d = this.series()?.donut ?? { delivered: 0, partial: 0, notDelivered: 0, pending: 0 };
    const empty = d.delivered + d.partial + d.notDelivered + d.pending === 0;
    return {
      type: 'doughnut',
      data: {
        labels: ['Entregadas', 'Parciales', 'No entregadas', 'Pendientes'],
        datasets: [
          {
            data: empty ? [1] : [d.delivered, d.partial, d.notDelivered, d.pending],
            backgroundColor: empty ? ['#e2e8f0'] : [BLUE, BLUE_LIGHT, INK, '#e2e8f0'],
            borderWidth: 0,
            hoverOffset: 4,
            spacing: 2,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        plugins: { tooltip: { enabled: !empty, displayColors: true } },
      },
    };
  });

  donutLegend = computed(() => {
    const d = this.series()?.donut;
    return [
      { label: 'Entregadas', value: d?.delivered ?? 0, color: BLUE },
      { label: 'Parciales', value: d?.partial ?? 0, color: BLUE_LIGHT },
      { label: 'No entregadas', value: d?.notDelivered ?? 0, color: INK },
      { label: 'Pendientes', value: d?.pending ?? 0, color: '#e2e8f0' },
    ];
  });

  // ───── Heatmap día × hora ─────
  heatRows = computed(() => {
    const h = this.series()?.heatmap;
    if (!h) return [];
    const rows = this.weekdays.map((label, wd) => ({
      label,
      cells: this.hourBuckets.map((start) => ({ start, value: (h[wd]?.[start] ?? 0) + (h[wd]?.[start + 1] ?? 0) })),
    }));
    return rows;
  });
  heatMax = computed(() => Math.max(1, ...this.heatRows().flatMap((r) => r.cells.map((c) => c.value))));

  ngOnInit() {
    this.api.kpis().subscribe((k) => this.kpis.set(k));
    this.loadSeries();
    // RN-SYN-02: "en ruta" = todo lo que no está cerrado.
    this.api.routes().subscribe((r) => {
      this.active.set(r.filter((x) => !TERMINAL_ROUTE_STATUSES.includes(x.status)).slice(0, 6));
      this.loading.set(false);
    });
  }

  setPeriod(p: Period) {
    if (this.period() === p) return;
    this.period.set(p);
    this.loadSeries();
  }

  private loadSeries() {
    this.api.series(this.period()).subscribe((s) => this.series.set(s));
  }

  progress(r: RouteSummary): number {
    const total = r._count?.events ?? r.events?.length ?? 0;
    if (!total) return 0;
    const done = (r.events ?? []).filter((e) => e.status === 'COMPLETED').length;
    return Math.round((done / total) * 100);
  }

  heatClass(v: number): string {
    if (!v) return 'h0';
    const q = v / this.heatMax();
    return q > 0.75 ? 'h4' : q > 0.5 ? 'h3' : q > 0.25 ? 'h2' : 'h1';
  }

  trendClass(v?: number): string {
    return (v ?? 0) >= 0 ? 'up' : 'down';
  }

  trendText(v?: number): string {
    const n = v ?? 0;
    return `${n > 0 ? '+' : ''}${n}%`;
  }

  money(n?: number | null): string {
    return (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  }

  dayLabel(): string {
    const d = this.kpis()?.day;
    if (!d) return 'hoy';
    return this.longDay(d);
  }

  todayRoutes(): number {
    const k = this.kpis();
    if (!k) return 0;
    return k.pending + k.enroute + k.paused + k.completed;
  }

  shortDay(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '');
  }

  longDay(day?: string): string {
    if (!day) return '';
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  pillClass(kind: string): string {
    switch (kind) {
      case 'ok':
        return 'bg-ok-bg text-ok';
      case 'info':
        return 'bg-info-bg text-info';
      case 'warn':
        return 'bg-warn-bg text-warn';
      case 'danger':
        return 'bg-danger-bg text-danger';
      default:
        return 'bg-ink-100 text-ink-700';
    }
  }

  initials(name?: string | null): string {
    return (name ?? '?')
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }
}
