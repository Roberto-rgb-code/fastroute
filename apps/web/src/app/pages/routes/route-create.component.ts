import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Client, Driver, RouteTemplate, Stop, Vehicle } from '../../core/models';
import { DRIVER_LABEL, STOP_TYPE_LABEL, VEHICLE_LABEL } from '../../core/status';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-route-create',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  templateUrl: './route-create.component.html',
  styleUrl: './route-create.component.scss',
})
export class RouteCreateComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private activated = inject(ActivatedRoute);

  step = signal(1);
  saving = signal(false);
  error = signal<string | null>(null);

  drivers = signal<Driver[]>([]);
  vehicles = signal<Vehicle[]>([]);
  clients = signal<Client[]>([]);
  stops = signal<Stop[]>([]);
  templates = signal<RouteTemplate[]>([]);

  readonly DRIVER_LABEL = DRIVER_LABEL;
  readonly VEHICLE_LABEL = VEHICLE_LABEL;
  readonly STOP_TYPE_LABEL = STOP_TYPE_LABEL;

  name = '';
  driverId = '';
  vehicleId = '';
  clientId = '';
  templateId = '';
  dateStart = this.defaultDate();
  stopQuery = signal('');
  selected = signal<string[]>([]);

  filteredStops = computed(() => {
    const q = this.stopQuery().toLowerCase().trim();
    const list = this.stops().filter((s) => !s.isArchived);
    if (!q) return list;
    return list.filter((s) => `${s.label} ${s.address} ${s.client?.name ?? ''}`.toLowerCase().includes(q));
  });

  ngOnInit() {
    this.api.drivers().subscribe((d) => this.drivers.set(d));
    this.api.vehicles().subscribe((v) => this.vehicles.set(v));
    this.api.clients().subscribe((c) => this.clients.set(c));
    this.api.stops().subscribe((s) => this.stops.set(s));
    this.api.templates().subscribe((t) => {
      this.templates.set(t);
      const pre = this.activated.snapshot.queryParamMap.get('template');
      if (pre) this.applyTemplate(pre);
    });
  }

  /** RN-RTE-07 / RN-DRV-02: solo libres y sin viaje abierto. */
  isDriverFree(d: Driver) {
    return d.status === 'AVAILABLE';
  }
  isVehicleFree(v: Vehicle) {
    return v.status === 'AVAILABLE';
  }

  applyTemplate(id: string) {
    this.templateId = id;
    const t = this.templates().find((x) => x.id === id);
    if (!t) return;
    this.selected.set(t.stops.map((s) => s.stop.id));
    if (t.clientId) this.clientId = t.clientId;
    if (!this.name.trim()) this.name = `${t.name} · ${this.dateStart.slice(0, 10)}`;
  }

  toggleStop(id: string) {
    const cur = this.selected();
    this.selected.set(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }
  isSelected(id: string) {
    return this.selected().includes(id);
  }
  orderOf(id: string) {
    return this.selected().indexOf(id) + 1;
  }
  move(id: string, delta: number) {
    const cur = [...this.selected()];
    const i = cur.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= cur.length) return;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    this.selected.set(cur);
  }
  stopById(id: string) {
    return this.stops().find((s) => s.id === id);
  }

  next() {
    if (this.step() === 1 && !this.name.trim()) {
      this.error.set('Ingresa un nombre para la ruta');
      return;
    }
    if (this.step() === 2 && (!this.driverId || !this.vehicleId)) {
      this.error.set('La ruta exige operador y unidad (RN-RTE-01)');
      return;
    }
    this.error.set(null);
    this.step.set(this.step() + 1);
  }
  back() {
    this.error.set(null);
    this.step.set(this.step() - 1);
  }

  save() {
    if (this.selected().length < 2) {
      this.error.set('Selecciona al menos origen y destino (2 paradas)');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api
      .createRoute({
        name: this.name.trim(),
        driverId: this.driverId,
        vehicleId: this.vehicleId,
        clientId: this.clientId || undefined,
        templateId: this.templateId || undefined,
        dateStart: new Date(this.dateStart).toISOString(),
        stopIds: this.selected(),
      })
      .subscribe({
        next: (r) => this.router.navigate(['/app/routes', r.id]),
        error: (e) => {
          this.saving.set(false);
          const m = e?.error?.message;
          this.error.set(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo crear la ruta'));
        },
      });
  }

  private defaultDate(): string {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
