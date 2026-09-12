import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Client, EnterpriseSettings, Stop, StopType } from '../../core/models';
import { STOP_TYPE_LABEL } from '../../core/status';
import { IconComponent } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

const EMPTY: Partial<Stop> = {
  label: '',
  address: '',
  lat: 20.6597,
  lng: -103.3496,
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
  imports: [FormsModule, PageHeaderComponent, IconComponent],
  templateUrl: './stops.component.html',
  styleUrl: './stops.component.scss',
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
    this.editing.set({ ...EMPTY });
  }

  edit(s: Stop) {
    this.error.set(null);
    this.editing.set({ ...s, clientId: s.clientId ?? '' });
  }

  applyTag(name: string) {
    const e = this.editing();
    if (!e) return;
    const t = this.settings()?.stop_tag.find((x) => x.name === name);
    this.editing.set({ ...e, tag: name || '', tagColor: t?.color ?? '' });
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
      lat: Number(e.lat),
      lng: Number(e.lng),
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
    const req = e.id ? this.api.updateStop(e.id, body) : this.api.createStop(body);
    req.subscribe({
      next: () => {
        this.editing.set(null);
        this.load();
      },
      error: (err) => {
        const m = err?.error?.message;
        this.error.set(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo guardar'));
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
