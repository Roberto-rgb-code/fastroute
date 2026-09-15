import type { RouteEvent } from '../../core/models';

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  NORMAL: 1,
  NOTURGENT: 2,
};

/** Orden sugerido local (prioridad + ETA) — espejo del backend. */
export function suggestStopOrder(events: RouteEvent[]): RouteEvent[] {
  return [...events].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? 1;
    const pb = PRIORITY_RANK[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    const ta = a.eta ? new Date(a.eta).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.eta ? new Date(b.eta).getTime() : Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return a.position - b.position;
  });
}

export function stopIdsInRoute(events: RouteEvent[]): Set<string> {
  return new Set(events.map((e) => e.stop?.id).filter(Boolean) as string[]);
}
