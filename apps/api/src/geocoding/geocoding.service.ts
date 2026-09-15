import { BadGatewayException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
  provider: string;
};

type ScriptResponse =
  | { ok: true; lat: number; lng: number; displayName: string; provider?: string; raw?: unknown }
  | { ok: false; error: string };

/**
 * Geocoding gratis vía geopy + Nominatim (OSM).
 * Serializa llamadas (~1.1s) para respetar la política de uso de Nominatim.
 */
@Injectable()
export class GeocodingService implements OnModuleDestroy {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, { at: number; value: GeocodeResult }>();
  private readonly cacheTtlMs = 24 * 60 * 60 * 1000;
  private queue: Promise<void> = Promise.resolve();
  private lastCallAt = 0;
  private readonly minIntervalMs = 1100;

  constructor(private readonly config: ConfigService) {}

  onModuleDestroy() {
    this.cache.clear();
  }

  async forward(query: string, country = 'mx'): Promise<GeocodeResult> {
    const q = query.trim();
    if (q.length < 3) {
      throw new NotFoundException('Dirección demasiado corta para geocodificar');
    }
    const key = `f:${country.toLowerCase()}:${q.toLowerCase()}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.cacheTtlMs) return hit.value;

    const result = await this.enqueue(() =>
      this.runScript({ action: 'forward', query: q, country: country.toLowerCase() }),
    );
    this.cache.set(key, { at: Date.now(), value: result });
    return result;
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult> {
    const key = `r:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.cacheTtlMs) return hit.value;

    const result = await this.enqueue(() => this.runScript({ action: 'reverse', lat, lng }));
    this.cache.set(key, { at: Date.now(), value: result });
    return result;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.minIntervalMs - (Date.now() - this.lastCallAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCallAt = Date.now();
      return fn();
    });
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private resolvePython(): { bin: string; script: string } {
    const configuredScript = this.config.get<string>('GEOCODE_SCRIPT');
    const configuredBin = this.config.get<string>('GEOCODE_PYTHON');
    const roots = [
      join(process.cwd(), 'geopy'),
      join(__dirname, '..', '..', 'geopy'),
      join(__dirname, '..', '..', '..', 'geopy'),
    ];
    const script =
      configuredScript ||
      roots.map((r) => join(r, 'geocode.py')).find((p) => existsSync(p)) ||
      '';
    const candidates = [
      configuredBin,
      ...roots.map((r) => join(r, '.venv', 'bin', 'python')),
      ...roots.map((r) => join(r, '.venv', 'bin', 'python3')),
      'python3',
      'python',
    ].filter(Boolean) as string[];

    const bin = candidates.find((c) => c === 'python3' || c === 'python' || existsSync(c));
    if (!bin || !script || !existsSync(script)) {
      throw new BadGatewayException(
        'Geocoder geopy no configurado. Instala: cd apps/api/geopy && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt',
      );
    }
    return { bin, script };
  }

  private runScript(payload: Record<string, unknown>): Promise<GeocodeResult> {
    const { bin, script } = this.resolvePython();
    return new Promise((resolve, reject) => {
      const child = spawn(bin, [script], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new BadGatewayException('Geocoding timeout'));
      }, 20000);

      child.stdout.on('data', (d: Buffer) => {
        stdout += d.toString('utf8');
      });
      child.stderr.on('data', (d: Buffer) => {
        stderr += d.toString('utf8');
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        this.logger.error(`geopy spawn failed: ${err.message}`);
        reject(new BadGatewayException('No se pudo ejecutar geopy'));
      });
      child.on('close', () => {
        clearTimeout(timer);
        try {
          const line = stdout.trim().split('\n').filter(Boolean).pop() || '';
          const parsed = JSON.parse(line) as ScriptResponse;
          if (!parsed.ok) {
            reject(new NotFoundException(parsed.error || 'Dirección no encontrada'));
            return;
          }
          resolve({
            lat: parsed.lat,
            lng: parsed.lng,
            displayName: parsed.displayName,
            provider: parsed.provider || 'nominatim',
          });
        } catch (e) {
          this.logger.error(`geopy bad output: ${stdout || stderr}`);
          reject(new BadGatewayException('Respuesta inválida del geocoder'));
        }
      });
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });
  }
}
