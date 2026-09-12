/**
 * Día operativo (sección 5.3): hora de México, UTC-6 fijo.
 * Día de una ruta = DATE(COALESCE(date_started, date_start) - 6h).
 */
export const BUSINESS_TZ_OFFSET_HOURS = -6;

const HOUR = 3600_000;

/** Devuelve 'YYYY-MM-DD' del día operativo para un instante UTC. */
export function businessDayOf(date: Date): string {
  const shifted = new Date(date.getTime() + BUSINESS_TZ_OFFSET_HOURS * HOUR);
  return shifted.toISOString().slice(0, 10);
}

/** Día operativo de hoy. */
export function todayBusinessDay(): string {
  return businessDayOf(new Date());
}

/**
 * Rango UTC [start, end) que cubre el día operativo indicado ('YYYY-MM-DD').
 * 00:00 en UTC-6 equivale a 06:00 UTC.
 */
export function businessDayRange(day: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error('Fecha inválida, usa YYYY-MM-DD');
  const start = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], -BUSINESS_TZ_OFFSET_HOURS, 0, 0));
  const end = new Date(start.getTime() + 24 * HOUR);
  return { start, end };
}

/** Desplaza un día operativo 'YYYY-MM-DD' en ±n días. */
export function shiftDay(day: string, delta: number): string {
  const { start } = businessDayRange(day);
  return businessDayOf(new Date(start.getTime() + delta * 24 * HOUR + HOUR)); // +1h para quedar dentro del día
}

/** Inicio real del viaje (RN-1.6): dateStarted si existe, si no dateStart. */
export function effectiveStart(route: { dateStarted: Date | null; dateStart: Date }): Date {
  return route.dateStarted ?? route.dateStart;
}
