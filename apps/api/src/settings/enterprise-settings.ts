/**
 * Catálogo de settings por empresa (sección 3 del catálogo de reglas de negocio).
 * Los valores se guardan en `Enterprise.settings` (JSON) y se completan con estos defaults.
 */
export interface StopTag {
  name: string;
  color: string;
}

export interface EnterpriseSettings {
  /** RN-NOT-03: muestra acción SMS en la parada. */
  sms_active: boolean;
  /** RN-EVT-09/10: 0 autoaprueba evidencia; 1 espera aprobación del admin. */
  stops_wait_approval: boolean;
  /** RN-EVT-11/12: 0 exige orden; 1 libera cualquier parada. */
  stops_order_restriction: boolean;
  /** RN-STP-06: etiquetas disponibles para paradas. */
  stop_tag: StopTag[];
  /** RN-MEM-01: 0 bloquea el panel. */
  active_membership: boolean;
  /** RN-NOT-01: habilita notificar chofer por WhatsApp. */
  whatsapp_notifications: boolean;
  /** RN-MEM-02: tope de usuarios, 0 = sin tope. */
  max_users_per_ent: number;
  /** RN-EVT-13: exige pad de firma en la entrega. */
  signature_active: boolean;
}

export const DEFAULT_SETTINGS: EnterpriseSettings = {
  sms_active: false,
  stops_wait_approval: false,
  stops_order_restriction: false,
  stop_tag: [],
  active_membership: true,
  whatsapp_notifications: false,
  max_users_per_ent: 0,
  signature_active: false,
};

const BOOL_KEYS: (keyof EnterpriseSettings)[] = [
  'sms_active',
  'stops_wait_approval',
  'stops_order_restriction',
  'active_membership',
  'whatsapp_notifications',
  'signature_active',
];

/** Acepta 1/0, "1"/"0", true/false para compatibilidad con Rutaflow. */
function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  if (v === 0 || v === '0' || v === 'false') return false;
  return fallback;
}

export function normalizeSettings(raw: unknown): EnterpriseSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: EnterpriseSettings = { ...DEFAULT_SETTINGS, stop_tag: [] };
  for (const k of BOOL_KEYS) {
    (out as unknown as Record<string, unknown>)[k] = toBool(src[k], DEFAULT_SETTINGS[k] as boolean);
  }
  const max = Number(src['max_users_per_ent']);
  out.max_users_per_ent = Number.isFinite(max) && max >= 0 ? Math.floor(max) : 0;
  if (Array.isArray(src['stop_tag'])) {
    out.stop_tag = (src['stop_tag'] as unknown[])
      .filter((t): t is StopTag => !!t && typeof t === 'object' && 'name' in (t as object))
      .map((t) => ({ name: String(t.name), color: String(t.color ?? '#6366f1') }));
  }
  return out;
}
