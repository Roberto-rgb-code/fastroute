import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Client, EnterpriseSettings, Stop, StopType } from '../../core/models';
import { STOP_TYPE_LABEL } from '../../core/status';
import { IconComponent } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { EntityViewToggleComponent } from '../../shared/entity-view-toggle.component';
import { loadEntityView } from '../../shared/entity-view';

const EMPTY: Partial<Stop> = {
  label: '',
  address: '',
  lat: undefined,
  lng: undefined,
  type: 'VISIT',
  isMain: false,
  clientId: '',
  phoneNotification: '',
  schedule: '',
  commentInternal: '',
  commentDriver: '',
  tag: '',
  tagColor: '',
  reference: '',
};

@Component({
  selector: 'app-stops',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, IconComponent, EntityViewToggleComponent],
  templateUrl: './stops.component.html',
  styleUrls: ['./stops.component.scss', '../drivers/entities.scss'],
})
export class StopsComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<Stop[]>([]);
  clients = signal<Client[]>([]);
  settings = signal<EnterpriseSettings | null>(null);
  showArchived = signal(false);
  query = signal('');
  typeFilter = signal<StopType | 'ALL'>('ALL');
  editing = signal<Partial<Stop> | null>(null);
  error = signal<string | null>(null);
  geocoding = signal(false);
  geocodeHint = signal<string | null>(null);
  viewMode = signal(loadEntityView('stops', 'list'));

  readonly STOP_TYPE_LABEL = STOP_TYPE_LABEL;
  readonly types: StopType[] = ['VISIT', 'CEDIS', 'MAIN', 'GAS', 'PARKING', 'WORKSHOP'];

  visible = computed(() => {
    const q = this.query().toLowerCase().trim();
    const t = this.typeFilter();
    return this.items().filter((s) => {
      if (t !== 'ALL' && s.type !== t) return false;
      if (!q) return true;
      return `${s.label} ${s.address} ${s.client?.name ?? ''} ${s.tag ?? ''}`.toLowerCase().includes(q);
    });
  });

  ngOnInit() {
    this.api.clients().subscribe((c) => this.clients.set(c));
    this.api.settings().subscribe({ next: (s) => this.settings.set(s), error: () => null });
    this.load();
  }

  load() {
    this.api.stops({ includeArchived: this.showArchived() }).subscribe((s) => this.items.set(s));
  }

  toggleArchived() {
    this.showArchived.update((v) => !v);
    this.load();
  }

  create() {
    this.error.set(null);
    this.geocodeHint.set(null);
    this.editing.set({ ...EMPTY });
  }

  edit(s: Stop) {
    this.error.set(null);
    this.geocodeHint.set(null);
    this.editing.set({ ...s, clientId: s.clientId ?? '' });
  }

  applyTag(name: string) {
    const e = this.editing();
    if (!e) return;
    const t = this.settings()?.stop_tag.find((x) => x.name === name);
    this.editing.set({ ...e, tag: name || '', tagColor: t?.color ?? '' });
  }

  geocodeAddress() {
    const e = this.editing();
    if (!e?.address?.trim()) {
      this.error.set('Escribe una dirección primero');
      return;
    }
    this.error.set(null);
    this.geocodeHint.set(null);
    this.geocoding.set(true);
    this.api.geocode(e.address.trim()).subscribe({
      next: (g) => {
        this.geocoding.set(false);
        this.editing.set({ ...e, lat: g.lat, lng: g.lng });
        this.geocodeHint.set(g.displayName);
      },
      error: (err) => {
        this.geocoding.set(false);
        const m = err?.error?.message;
        this.error.set(Array.isArray(m) ? m.join(', ') : m || 'No se pudo geocodificar (Nominatim)');
      },
    });
  }

  save() {
    const e = this.editing();
    if (!e) return;
    if (!e.label?.trim() || !e.address?.trim()) {
      this.error.set('Etiqueta y dirección son obligatorias');
      return;
    }
    const body: Partial<Stop> = {
      label: e.label.trim(),
      address: e.address.trim(),
      type: e.type,
      isMain: !!e.isMain,
      clientId: e.clientId || undefined,
      phoneNotification: e.phoneNotification || undefined,
      schedule: e.schedule || undefined,
      commentInternal: e.commentInternal || undefined,
      commentDriver: e.commentDriver || undefined,
      tag: e.tag || undefined,
      tagColor: e.tagColor || undefined,
      reference: e.reference || undefined,
    };
    if (e.lat != null && e.lng != null && Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng))) {
      body.lat = Number(e.lat);
      body.lng = Number(e.lng);
    }
    const req = e.id ? this.api.updateStop(e.id, body) : this.api.createStop(body);
    req.subscribe({
      next: () => {
        this.editing.set(null);
        this.geocodeHint.set(null);
        this.load();
      },
      error: (err) => {
        const m = err?.error?.message;
        this.error.set(Array.isArray(m) ? m.join(', ') : m || 'Error al guardar');
      },
    });
  }

  archive(s: Stop) {
    const msg = s._count?.events
      ? `“${s.label}” tiene historial: se archivará (no se borra).`
      : `¿Eliminar “${s.label}”?`;
    if (!confirm(msg)) return;
    this.api.deleteStop(s.id).subscribe(() => this.load());
  }

  restore(s: Stop) {
    this.api.updateStop(s.id, { isArchived: false }).subscribe(() => this.load());
  }
}
