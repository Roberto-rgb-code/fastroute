import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Client, RouteTemplate, Stop } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, IconComponent],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss',
})
export class TemplatesComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  items = signal<RouteTemplate[]>([]);
  stops = signal<Stop[]>([]);
  clients = signal<Client[]>([]);
  editing = signal<{ id?: string; name: string; clientId: string; stopIds: string[] } | null>(null);
  error = signal<string | null>(null);
  stopQuery = signal('');

  filteredStops = computed(() => {
    const q = this.stopQuery().toLowerCase().trim();
    const list = this.stops();
    return q ? list.filter((s) => `${s.label} ${s.address}`.toLowerCase().includes(q)) : list;
  });

  ngOnInit() {
    this.api.stops().subscribe((s) => this.stops.set(s));
    this.api.clients().subscribe((c) => this.clients.set(c));
    this.load();
  }

  load() {
    this.api.templates().subscribe((t) => this.items.set(t));
  }

  create() {
    this.error.set(null);
    this.editing.set({ name: '', clientId: '', stopIds: [] });
  }

  edit(t: RouteTemplate) {
    this.error.set(null);
    this.editing.set({ id: t.id, name: t.name, clientId: t.clientId ?? '', stopIds: t.stops.map((s) => s.stop.id) });
  }

  toggle(id: string) {
    const e = this.editing();
    if (!e) return;
    const ids = e.stopIds.includes(id) ? e.stopIds.filter((x) => x !== id) : [...e.stopIds, id];
    this.editing.set({ ...e, stopIds: ids });
  }
  move(id: string, delta: number) {
    const e = this.editing();
    if (!e) return;
    const ids = [...e.stopIds];
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.editing.set({ ...e, stopIds: ids });
  }
  stopById(id: string) {
    return this.stops().find((s) => s.id === id);
  }

  save() {
    const e = this.editing();
    if (!e) return;
    if (!e.name.trim()) return this.error.set('Ponle nombre a la plantilla');
    if (e.stopIds.length < 2) return this.error.set('La plantilla requiere origen y destino');
    const body = { name: e.name.trim(), clientId: e.clientId || undefined, stopIds: e.stopIds };
    const req = e.id ? this.api.updateTemplate(e.id, body) : this.api.createTemplate(body);
    req.subscribe({
      next: () => {
        this.editing.set(null);
        this.load();
      },
      error: (err) => this.error.set(err?.error?.message ?? 'No se pudo guardar'),
    });
  }

  remove(t: RouteTemplate) {
    if (!confirm(`¿Eliminar la plantilla “${t.name}”? Las rutas ya creadas no se afectan.`)) return;
    this.api.deleteTemplate(t.id).subscribe(() => this.load());
  }

  useTemplate(t: RouteTemplate) {
    void this.router.navigate(['/app/routes/new'], { queryParams: { template: t.id } });
  }

  km(m?: number | null) {
    return m ? (m / 1000).toFixed(1) + ' km' : '—';
  }
  dur(s?: number | null) {
    if (!s) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  }
}
