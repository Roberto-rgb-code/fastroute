import { Injectable, Logger } from '@nestjs/common';

export interface WeatherNow {
  tempC: number | null;
  windKmh: number | null;
  windDir: number | null;
  precipMm: number | null;
  code: number | null;
  label: string;
  isDay: boolean;
}

export interface WeatherResult {
  lat: number;
  lng: number;
  now: WeatherNow;
  hourly: { time: string; tempC: number; precipMm: number; windKmh: number }[];
  fetchedAt: string;
}

interface CacheEntry {
  at: number;
  data: WeatherResult;
}

/** WMO weather codes → etiqueta corta en español. */
const WMO: Record<number, string> = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna',
  55: 'Llovizna intensa',
  61: 'Lluvia ligera',
  63: 'Lluvia',
  65: 'Lluvia fuerte',
  66: 'Lluvia helada',
  67: 'Lluvia helada fuerte',
  71: 'Nieve ligera',
  73: 'Nieve',
  75: 'Nieve fuerte',
  80: 'Chubascos',
  81: 'Chubascos',
  82: 'Chubascos violentos',
  95: 'Tormenta',
  96: 'Tormenta con granizo',
  99: 'Tormenta con granizo',
};

/**
 * Clima vía Open-Meteo (gratis, sin API key).
 * @see https://open-meteo.com/en/docs
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 30 * 60 * 1000; // 30 min

  async forecast(latRaw: number, lngRaw: number): Promise<WeatherResult> {
    const lat = Math.round(latRaw * 100) / 100;
    const lng = Math.round(lngRaw * 100) / 100;
    const key = `${lat},${lng}`;

    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) {
      return hit.data;
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day` +
      `&hourly=temperature_2m,precipitation,wind_speed_10m` +
      `&forecast_days=1&wind_speed_unit=kmh&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo ${res.status}`);
    }
    const json = (await res.json()) as OpenMeteoResponse;

    const code = json.current?.weather_code ?? null;
    const now: WeatherNow = {
      tempC: json.current?.temperature_2m ?? null,
      windKmh: json.current?.wind_speed_10m ?? null,
      windDir: json.current?.wind_direction_10m ?? null,
      precipMm: json.current?.precipitation ?? null,
      code,
      label: code != null ? (WMO[code] ?? 'Desconocido') : 'Desconocido',
      isDay: json.current?.is_day === 1,
    };

    const times = json.hourly?.time ?? [];
    const hourly = times.slice(0, 24).map((time, i) => ({
      time,
      tempC: json.hourly?.temperature_2m?.[i] ?? 0,
      precipMm: json.hourly?.precipitation?.[i] ?? 0,
      windKmh: json.hourly?.wind_speed_10m?.[i] ?? 0,
    }));

    const data: WeatherResult = { lat, lng, now, hourly, fetchedAt: new Date().toISOString() };
    this.cache.set(key, { at: Date.now(), data });
    return data;
  }
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    is_day?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation?: number[];
    wind_speed_10m?: number[];
  };
}
