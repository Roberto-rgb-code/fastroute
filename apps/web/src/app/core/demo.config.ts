/** Ruta y coordenadas de demo (seed: «Ruta 1 · Camioneta 1», Guadalajara). */
export const DEMO_ROUTE_NAME = 'Ruta 1 · Camioneta 1';

/** Centro operativo demo — clima y mapa sin esperar geocoding. */
export const DEMO_WEATHER = {
  lat: 20.6597,
  lng: -103.3496,
  label: 'Guadalajara, Jalisco',
} as const;

/** Máximo de paradas en mapa «overview» (sin ruta seleccionada) para no congelar el UI. */
export const MAP_OVERVIEW_MAX_STOPS = 12;

/**
 * Demo planificador: orden mezclado al abrir la pestaña Plan (Ruta 1).
 * Al pulsar Optimizar, las tarjetas se animan hacia AFTER (urgente primero + recorrido lógico).
 */
export const DEMO_PLANNER_BEFORE_LABELS = [
  'Vitacura 500',
  'Santiago Centro',
  'Ñuñoa 300',
  'Providencia 100',
  'Las Condes 200',
] as const;

export const DEMO_PLANNER_AFTER_LABELS = [
  'Las Condes 200',
  'Providencia 100',
  'Vitacura 500',
  'Ñuñoa 300',
  'Santiago Centro',
] as const;
