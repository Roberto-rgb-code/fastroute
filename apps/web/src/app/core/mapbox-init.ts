/**
 * Mapbox GL JS por CDN en `index.html` (guía oficial npm/CDN).
 * No usar `const mapboxgl = window.mapboxgl` al importar: el bundle Angular
 * puede evaluarse antes que el script y dejar `undefined` → "Mapbox no configurado".
 *
 * @see https://docs.mapbox.com/mapbox-gl-js/guides/install/
 */
import type * as MapboxGL from 'mapbox-gl';

declare global {
  interface Window {
    mapboxgl: typeof MapboxGL.default;
  }
}

export const MAPBOX_GL_JS_VERSION = '3.30.0';

export async function waitForMapboxGl(timeoutMs = 15000): Promise<typeof MapboxGL.default> {
  if (window.mapboxgl) return window.mapboxgl;
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (window.mapboxgl) {
        resolve(window.mapboxgl);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Mapbox GL JS no cargó (CDN api.mapbox.com)'));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Acceso en runtime al global del CDN (nunca capturar al importar el módulo). */
export function getMapboxGl(): typeof MapboxGL.default {
  const gl = window.mapboxgl;
  if (!gl) {
    throw new Error('Mapbox GL JS no está disponible; revisa el script en index.html');
  }
  return gl;
}

/** Proxy para `mapboxgl.Map`, `NavigationControl`, etc., siempre leyendo `window.mapboxgl`. */
export const mapboxgl = new Proxy({} as typeof MapboxGL.default, {
  get(_target, prop) {
    const gl = getMapboxGl();
    const value = Reflect.get(gl as object, prop) as unknown;
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(gl);
    }
    return value;
  },
  set(_target, prop, value) {
    return Reflect.set(getMapboxGl() as object, prop, value);
  },
});

export declare namespace mapboxgl {
  export type Map = MapboxGL.Map;
  export type Marker = MapboxGL.Marker;
  export type Popup = MapboxGL.Popup;
  export type LngLatBounds = MapboxGL.LngLatBounds;
  export type GeoJSONSource = MapboxGL.GeoJSONSource;
  export type ErrorEvent = MapboxGL.ErrorEvent;
}
