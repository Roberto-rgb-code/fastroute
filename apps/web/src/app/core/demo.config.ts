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
