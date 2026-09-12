import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  afterNextRender,
  effect,
  input,
  untracked,
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

// Estilo global tipo dashboard SaaS (Dasybo): sin bordes duros, tipografía suave.
Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = '#64748b';
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = '#0f172a';
Chart.defaults.plugins.tooltip.titleFont = { size: 11, weight: 'normal' };
Chart.defaults.plugins.tooltip.bodyFont = { size: 12, weight: 'bold' };
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.displayColors = false;

/**
 * Envoltura ligera de Chart.js.
 * Uso: <app-chart [config]="cfg" [height]="220" />
 * Cuando cambia `config`, actualiza datos/opciones sin destruir el canvas.
 */
@Component({
  selector: 'app-chart',
  standalone: true,
  template: `<div class="chart-wrap" [style.height.px]="height()"><canvas #cv></canvas></div>`,
  styles: [
    `
      :host { display: block; width: 100%; }
      .chart-wrap { position: relative; width: 100%; }
      canvas { width: 100% !important; }
    `,
  ],
})
export class ChartComponent implements OnDestroy {
  config = input.required<ChartConfiguration>();
  height = input(220);

  @ViewChild('cv', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  private rendered = false;
  private lastType?: string;

  constructor() {
    afterNextRender(() => {
      this.rendered = true;
      this.draw(untracked(() => this.config()));
    });
    effect(() => {
      const cfg = this.config();
      if (this.rendered) this.draw(cfg);
    });
  }

  private draw(cfg: ChartConfiguration) {
    const next = 'type' in cfg ? String(cfg.type) : '';
    if (!this.chart || this.lastType !== next) {
      this.chart?.destroy();
      this.chart = new Chart(this.canvas.nativeElement, cfg);
      this.lastType = next;
      return;
    }
    this.chart.data = cfg.data;
    if (cfg.options) this.chart.options = cfg.options;
    this.chart.update();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
