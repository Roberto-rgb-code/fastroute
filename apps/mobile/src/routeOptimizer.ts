import type { RouteEvent } from './api';

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

/** Orden sugerido: prioridad → ETA → posición planificada. */
export function optimizeStopOrder(events: RouteEvent[]): RouteEvent[] {
  return [...events].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? 2;
    const pb = PRIORITY_RANK[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    const etaA = a.eta ? new Date(a.eta).getTime() : Number.MAX_SAFE_INTEGER;
    const etaB = b.eta ? new Date(b.eta).getTime() : Number.MAX_SAFE_INTEGER;
    if (etaA !== etaB) return etaA - etaB;
    return a.position - b.position;
  });
}

export function formatEta(eta?: string | null): string {
  if (!eta) return 'Sin hora';
  try {
    return new Date(eta).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Sin hora';
  }
}

export function estimateLegMinutes(totalDurationSec: number | undefined, stopCount: number, index: number): number | null {
  if (!totalDurationSec || stopCount < 1) return null;
  const perLeg = totalDurationSec / stopCount / 60;
  return Math.max(5, Math.round(perLeg * (index + 1)));
}
