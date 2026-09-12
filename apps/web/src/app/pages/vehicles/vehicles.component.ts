import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Vehicle, VehicleStatus } from '../../core/models';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';
import { VEHICLE_BADGE, VEHICLE_LABEL } from '../../core/status';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, IconComponent],
  templateUrl: './vehicles.component.html',
  styleUrl: '../drivers/entities.scss',
})
export class VehiclesComponent implements OnInit {
  private api = inject(ApiService);
  items = signal<Vehicle[]>([]);
  showForm = signal(false);
  plate = '';
  name = '';
  capacity?: number;

  VEHICLE_LABEL = VEHICLE_LABEL;
  VEHICLE_BADGE = VEHICLE_BADGE;
  statuses: VehicleStatus[] = ['AVAILABLE', 'WORKSHOP', 'UNAVAILABLE', 'PAUSED'];
  routeDriven(s: VehicleStatus) {
    return ['ENROUTE', 'CHECKLIST', 'CHECKLIST_PENDING'].includes(s);
  }

  ngOnInit() {
    this.load();
  }
  load() {
    this.api.vehicles().subscribe((v) => this.items.set(v));
  }
  create() {
    if (!this.plate.trim()) return;
    this.api.createVehicle({ plate: this.plate, name: this.name, capacity: this.capacity }).subscribe(() => {
      this.plate = this.name = '';
      this.capacity = undefined;
      this.showForm.set(false);
      this.load();
    });
  }
  setStatus(v: Vehicle, status: VehicleStatus) {
    this.api.updateVehicle(v.id, { status }).subscribe(() => this.load());
  }
  remove(v: Vehicle) {
    if (confirm(`¿Eliminar ${v.plate}?`)) this.api.deleteVehicle(v.id).subscribe(() => this.load());
  }
}
