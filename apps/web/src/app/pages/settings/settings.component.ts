import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EnterpriseSettings } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

interface Toggle {
  key: keyof EnterpriseSettings;
  title: string;
  desc: string;
  rule: string;
  group: 'operacion' | 'notificaciones' | 'plataforma';
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, IconComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private api = inject(ApiService);
  readonly auth = inject(AuthService);

  s = signal<EnterpriseSettings | null>(null);
  saving = signal(false);
  ok = signal<string | null>(null);
  error = signal<string | null>(null);

  newTag = '';
  newTagColor = '#6366f1';

  toggles: Toggle[] = [
    {
      key: 'stops_wait_approval',
      title: 'Aprobación de paradas',
      desc: 'La evidencia no se autoaprueba: la parada queda pendiente hasta que un admin la apruebe desde el panel.',
      rule: 'RN-EVT-09/10',
      group: 'operacion',
    },
    {
      key: 'stops_order_restriction',
      title: 'Liberar orden de paradas',
      desc: 'Apagado: el operador solo abre la siguiente parada cuando la anterior ya tiene foto. Encendido: puede atender cualquier parada.',
      rule: 'RN-EVT-11/12',
      group: 'operacion',
    },
    {
      key: 'signature_active',
      title: 'Firma del cliente',
      desc: 'La entrega en la app exige el pad de firma; se guarda como imagen junto a la evidencia.',
      rule: 'RN-EVT-13',
      group: 'operacion',
    },
    {
      key: 'sms_active',
      title: 'SMS en parada',
      desc: 'Muestra en la app la acción de avisar por SMS al teléfono de notificación de la parada.',
      rule: 'RN-NOT-03/04',
      group: 'notificaciones',
    },
    {
      key: 'whatsapp_notifications',
      title: 'WhatsApp al chofer',
      desc: 'Permite notificar al operador cuando la ruta está en ruta o pausada y tiene teléfono.',
      rule: 'RN-NOT-01',
      group: 'notificaciones',
    },
    {
      key: 'active_membership',
      title: 'Membresía activa',
      desc: 'Apagada bloquea el panel de la empresa: “Tu periodo de prueba ha terminado”.',
      rule: 'RN-MEM-01',
      group: 'plataforma',
    },
  ];

  groups: { id: Toggle['group']; label: string; icon: string }[] = [
    { id: 'operacion', label: 'Operación en campo', icon: 'route' },
    { id: 'notificaciones', label: 'Notificaciones', icon: 'bell' },
    { id: 'plataforma', label: 'Plataforma (solo super admin)', icon: 'building' },
  ];

  ngOnInit() {
    this.api.settings().subscribe({ next: (s) => this.s.set(s), error: (e) => this.error.set(e?.error?.message ?? 'No se pudo cargar') });
  }

  byGroup(g: Toggle['group']) {
    return this.toggles.filter((t) => t.group === g);
  }

  canEdit(t: Toggle) {
    return t.group !== 'plataforma' || this.auth.isSuper();
  }

  toggle(t: Toggle) {
    const cur = this.s();
    if (!cur || !this.canEdit(t)) return;
    this.persist({ [t.key]: !cur[t.key] } as Partial<EnterpriseSettings>);
  }

  setMaxUsers(v: string) {
    if (!this.auth.isSuper()) return;
    this.persist({ max_users_per_ent: Math.max(0, Number(v) || 0) });
  }

  addTag() {
    const cur = this.s();
    const name = this.newTag.trim();
    if (!cur || !name) return;
    if (cur.stop_tag.some((t) => t.name.toLowerCase() === name.toLowerCase())) return;
    this.persist({ stop_tag: [...cur.stop_tag, { name, color: this.newTagColor }] });
    this.newTag = '';
  }

  removeTag(name: string) {
    const cur = this.s();
    if (!cur) return;
    this.persist({ stop_tag: cur.stop_tag.filter((t) => t.name !== name) });
  }

  private persist(patch: Partial<EnterpriseSettings>) {
    this.saving.set(true);
    this.error.set(null);
    const req = this.auth.isSuper() && this.auth.activeEnterpriseId()
      ? this.api.updateSuperSettings(this.auth.activeEnterpriseId()!, patch)
      : this.api.updateSettings(patch);
    req.subscribe({
      next: (s) => {
        this.s.set(s);
        this.saving.set(false);
        this.ok.set('Guardado');
        setTimeout(() => this.ok.set(null), 2000);
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e?.error?.message ?? 'No se pudo guardar');
      },
    });
  }
}
