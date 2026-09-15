/** Campo de viento 2D (u,v) en unidades de “px por frame” para animación. */
export interface WindFieldCell {
  u: number;
  v: number;
  speedKmh: number;
}

/**
 * Partículas estilo demo Mapbox (tema Vivid) cuando GFS raster-array no está disponible.
 */
export class WindParticleOverlay {
  private shell: HTMLElement;
  private dimmer: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: { x: number; y: number; age: number }[] = [];
  private cols = 1;
  private rows = 1;
  private grid: WindFieldCell[] = [{ u: 0.15, v: 0, speedKmh: 10 }];
  private raf = 0;
  private running = false;
  private readonly count: number;
  private t = 0;

  constructor(parent: HTMLElement, particleCount = 2800) {
    this.count = particleCount;
    this.shell = parent;

    this.dimmer = document.createElement('div');
    this.dimmer.className =
      'pointer-events-none absolute inset-0 z-[1] bg-slate-900/25';
    this.dimmer.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.dimmer);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pointer-events-none absolute inset-0 z-[2] h-full w-full';
    this.canvas.style.mixBlendMode = 'normal';
    this.canvas.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.seedParticles();
  }

  static vectorFromMeteo(speedKmh: number, windFromDeg: number | null): { u: number; v: number } {
    const kmh = Math.max(0, speedKmh);
    const mag = 0.12 + (kmh / 45) * 0.75;
    const toDeg = (windFromDeg ?? 0) + 180;
    const rad = (toDeg * Math.PI) / 180;
    return { u: mag * Math.sin(rad), v: -mag * Math.cos(rad) };
  }

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
    const w = this.shell.clientWidth;
    const h = this.shell.clientHeight;
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
      this.t += 0.016;
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
    this.dimmer.remove();
  }

  private seedParticles() {
    const w = this.shell.clientWidth || 400;
    const h = this.shell.clientHeight || 300;
    this.particles = Array.from({ length: this.count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      age: Math.random() * 120,
    }));
  }

  private sample(x: number, y: number): WindFieldCell {
    const w = this.shell.clientWidth || 1;
    const h = this.shell.clientHeight || 1;
    const gx = this.cols > 1 ? (x / w) * (this.cols - 1) : 0;
    const gy = this.rows > 1 ? (y / h) * (this.rows - 1) : 0;
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
    let u =
      lerp(lerp(g[i00]?.u ?? 0, g[i10]?.u ?? 0, tx), lerp(g[i01]?.u ?? 0, g[i11]?.u ?? 0, tx), ty);
    let v =
      lerp(lerp(g[i00]?.v ?? 0, g[i10]?.v ?? 0, tx), lerp(g[i01]?.v ?? 0, g[i11]?.v ?? 0, tx), ty);
    const speedKmh = lerp(
      lerp(g[i00]?.speedKmh ?? 0, g[i10]?.speedKmh ?? 0, tx),
      lerp(g[i01]?.speedKmh ?? 0, g[i11]?.speedKmh ?? 0, tx),
      ty,
    );
    const swirl =
      0.08 *
      Math.sin(this.t * 0.9 + x * 0.012 + y * 0.009) *
      Math.cos(this.t * 0.7 + x * 0.008 - y * 0.011);
    u += -v * swirl;
    v += u * swirl * 0.35;
    return { u, v, speedKmh };
  }

  private frame() {
    const w = this.shell.clientWidth;
    const h = this.shell.clientHeight;
    if (w < 1 || h < 1) return;

    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.fillStyle = 'rgba(0,0,0,0.88)';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.globalCompositeOperation = 'lighter';

    const lineScale = 5.5;
    for (const p of this.particles) {
      const { u, v, speedKmh } = this.sample(p.x, p.y);
      const px = p.x;
      const py = p.y;
      p.x += u;
      p.y += v;
      p.age += 1;
      if (p.x < 0) p.x += w;
      if (p.x > w) p.x -= w;
      if (p.y < 0) p.y += h;
      if (p.y > h) p.y -= h;
      if (p.age > 140) {
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.age = 0;
      }

      const spd = Math.hypot(u, v);
      this.ctx.strokeStyle = colorForWindSpeed(Math.max(speedKmh, spd * 35));
      this.ctx.lineWidth = spd > 0.35 ? 2 : 1.5;
      this.ctx.globalAlpha = 0.92;
      this.ctx.beginPath();
      this.ctx.moveTo(px, py);
      this.ctx.lineTo(px - u * lineScale, py - v * lineScale);
      this.ctx.stroke();
    }
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
  }
}

function colorForWindSpeed(kmh: number): string {
  const s = Math.max(0, kmh);
  if (s < 2) return '#86a3ab';
  if (s < 5) return '#7e98bc';
  if (s < 8) return '#6e8fd0';
  if (s < 12) return '#0f93a7';
  if (s < 18) return '#39a339';
  if (s < 28) return '#c2863e';
  if (s < 40) return '#c8420d';
  if (s < 55) return '#d20032';
  if (s < 70) return '#754a93';
  return '#c2fb77';
}
