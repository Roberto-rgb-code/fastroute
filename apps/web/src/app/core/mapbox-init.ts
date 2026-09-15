/**
 * Mapbox GL JS se carga por CDN desde `index.html`.
 * El bundle npm servido por Vite no consigue arrancar su WebWorker (el estilo
 * carga pero nunca se piden glifos ni tiles), así que la app usa el global
 * `mapboxgl` y el paquete queda solo como fuente de tipos.
 *
 * @see https://docs.mapbox.com/mapbox-gl-js/guides/install/
 */
import type * as MapboxGL from 'mapbox-gl';

declare global {
  interface Window {
    mapboxgl: typeof MapboxGL.default;
  }
}

/** Debe coincidir con la versión del <script> en index.html. */
export const MAPBOX_GL_JS_VERSION = '3.30.0';

export const mapboxgl = window.mapboxgl;

// Permite seguir escribiendo `mapboxgl.Map` en posición de tipo.
export declare namespace mapboxgl {
  export type Map = MapboxGL.Map;
  export type Marker = MapboxGL.Marker;
  export type Popup = MapboxGL.Popup;
  export type LngLatBounds = MapboxGL.LngLatBounds;
  export type GeoJSONSource = MapboxGL.GeoJSONSource;
  export type ErrorEvent = MapboxGL.ErrorEvent;
}
