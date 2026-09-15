export type EntityViewMode = 'cards' | 'list';

const PREFIX = 'fastroute_entity_view_';

export function loadEntityView(key: string, fallback: EntityViewMode = 'cards'): EntityViewMode {
  try {
    const v = localStorage.getItem(PREFIX + key);
    if (v === 'list' || v === 'cards') return v;
    return fallback;
  } catch {
    return fallback;
  }
}

export function saveEntityView(key: string, mode: EntityViewMode): void {
  try {
    localStorage.setItem(PREFIX + key, mode);
  } catch {
    /* storage optional */
  }
}
