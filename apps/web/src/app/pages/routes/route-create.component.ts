import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Client, Driver, Stop, Vehicle } from '../../core/models';

@Component({
  selector: 'app-route-create',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './route-create.component.html',
  styleUrl: './route-create.component.scss',
})
export class RouteCreateComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  step = signal(1);
  saving = signal(false);
  error = signal<string | null>(null);

  drivers = signal<Driver[]>([]);
  vehicles = signal<Vehicle[]>([]);
  clients = signal<Client[]>([]);
  stops = signal<Stop[]>([]);

  name = '';
  driverId = '';
  vehicleId = '';
  clientId = '';
  selected = signal<string[]>([]);

  ngOnInit() {
    this.api.drivers().subscribe((d) => this.drivers.set(d));
    this.api.vehicles().subscribe((v) => this.vehicles.set(v));
    this.api.clients().subscribe((c) => this.clients.set(c));
    this.api.stops().subscribe((s) => this.stops.set(s));
  }

  availableDrivers() {
    return this.drivers().filter((d) => d.status === 'AVAILABLE' || d.id === this.driverId);
  }
  availableVehicles() {
    return this.vehicles().filter((v) => v.status === 'AVAILABLE' || v.id === this.vehicleId);
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

  next() {
    if (this.step() === 1 && !this.name.trim()) {
      this.error.set('Ingresa un nombre para la ruta');
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
    if (this.selected().length === 0) {
      this.error.set('Selecciona al menos una parada');
      return;
    }
    this.saving.set(true);
    this.api
      .createRoute({
        name: this.name.trim(),
        driverId: this.driverId || undefined,
        vehicleId: this.vehicleId || undefined,
        clientId: this.clientId || undefined,
        stopIds: this.selected(),
      })
      .subscribe({
        next: (r) => this.router.navigate(['/app/routes', r.id]),
        error: () => {
          this.saving.set(false);
          this.error.set('No se pudo crear la ruta');
        },
      });
  }
}
