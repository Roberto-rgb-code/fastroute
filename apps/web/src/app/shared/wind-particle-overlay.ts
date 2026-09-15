/** Campo de viento 2D (u,v) en unidades de “px por frame” para animación. */
export interface WindFieldCell {
  u: number;
  v: number;
  speedKmh: number;
}

/**
 * Partículas estilo Mapbox (sin raster-array GFS).
 * Usa un grid de u/v interpolado bilinealmente sobre el canvas.
 */
export class WindParticleOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: { x: number; y: number }[] = [];
  private cols = 1;
  private rows = 1;
  private grid: WindFieldCell[] = [{ u: 0.15, v: 0, speedKmh: 10 }];
  private raf = 0;
  private running = false;
  private readonly count: number;

  constructor(parent: HTMLElement, particleCount = 900) {
    this.count = particleCount;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pointer-events-none absolute inset-0 z-[1] h-full w-full';
    this.canvas.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.seedParticles();
  }

  static vectorFromMeteo(speedKmh: number, windFromDeg: number | null): { u: number; v: number } {
    const kmh = Math.max(0, speedKmh);
    const mag = 0.06 + (kmh / 55) * 0.55;
    const toDeg = (windFromDeg ?? 0) + 180;
    const rad = (toDeg * Math.PI) / 180;
    return { u: mag * Math.sin(rad), v: -mag * Math.cos(rad) };
  }

  /** Grid row-major: grid[row * cols + col]. */
  setField(cols: number, rows: number, grid: WindFieldCell[]) {
    this.cols = Math.max(1, cols);
    this.rows = Math.max(1, rows);
    this.grid = grid.length ? grid : [{ u: 0.15, v: 0, speedKmh: 10 }];
  }

  setUniform(speedKmh: number, windFromDeg: number | null) {
    const { u, v } = WindParticleOverlay.vectorFromMeteo(speedKmh, windFromDeg);
    this.setField(1, 1, [{ u, v, speedKmh }]);
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w < 1 || h < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.seedParticles();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = () => {
      if (!this.running) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy() {
    this.stop();
    this.canvas.remove();
  }

  private seedParticles() {
    const w = this.canvas.clientWidth || 400;
    const h = this.canvas.clientHeight || 300;
    this.particles = Array.from({ length: this.count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
    }));
  }

  private sample(x: number, y: number): WindFieldCell {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const gx = (x / w) * (this.cols - 1);
    const gy = (y / h) * (this.rows - 1);
    const c0 = Math.floor(gx);
    const r0 = Math.floor(gy);
    const c1 = Math.min(c0 + 1, this.cols - 1);
    const r1 = Math.min(r0 + 1, this.rows - 1);
    const tx = gx - c0;
    const ty = gy - r0;
    const i00 = r0 * this.cols + c0;
    const i10 = r0 * this.cols + c1;
    const i01 = r1 * this.cols + c0;
    const i11 = r1 * this.cols + c1;
    const g = this.grid;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const u =
      lerp(lerp(g[i00]?.u ?? 0, g[i10]?.u ?? 0, tx), lerp(g[i01]?.u ?? 0, g[i11]?.u ?? 0, tx), ty);
    const v =
      lerp(lerp(g[i00]?.v ?? 0, g[i10]?.v ?? 0, tx), lerp(g[i01]?.v ?? 0, g[i11]?.v ?? 0, tx), ty);
    const speedKmh = lerp(
      lerp(g[i00]?.speedKmh ?? 0, g[i10]?.speedKmh ?? 0, tx),
      lerp(g[i01]?.speedKmh ?? 0, g[i11]?.speedKmh ?? 0, tx),
      ty,
    );
    return { u, v, speedKmh };
  }

  private frame() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w < 1 || h < 1) return;

    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.fillStyle = 'rgba(0,0,0,0.92)';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.globalCompositeOperation = 'source-over';

    const lineScale = 2.8;
    for (const p of this.particles) {
      const { u, v, speedKmh } = this.sample(p.x, p.y);
      const px = p.x;
      const py = p.y;
      p.x += u;
      p.y += v;
      if (p.x < 0) p.x += w;
      if (p.x > w) p.x -= w;
      if (p.y < 0) p.y += h;
      if (p.y > h) p.y -= h;

      this.ctx.strokeStyle = colorForWindSpeed(speedKmh);
      this.ctx.lineWidth = 1.35;
      this.ctx.globalAlpha = 0.75;
      this.ctx.beginPath();
      this.ctx.moveTo(px, py);
      this.ctx.lineTo(px - u * lineScale, py - v * lineScale);
      this.ctx.stroke();
    }
    this.ctx.globalAlpha = 1;
  }
}

/** Paleta inspirada en el ejemplo raster-particle de Mapbox. */
function colorForWindSpeed(kmh: number): string {
  const s = Math.max(0, kmh);
  if (s < 2) return 'rgba(134,163,171,0.85)';
  if (s < 6) return 'rgba(110,143,208,0.9)';
  if (s < 12) return 'rgba(15,147,167,0.9)';
  if (s < 20) return 'rgba(57,163,57,0.92)';
  if (s < 35) return 'rgba(194,134,62,0.92)';
  if (s < 50) return 'rgba(200,66,13,0.93)';
  if (s < 70) return 'rgba(210,0,50,0.93)';
  return 'rgba(175,80,136,0.94)';
}
