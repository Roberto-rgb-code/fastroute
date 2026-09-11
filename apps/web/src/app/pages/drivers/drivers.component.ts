import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Driver, DriverStatus } from '../../core/models';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';
import { DRIVER_BADGE, DRIVER_LABEL } from '../../core/status';

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, IconComponent],
  templateUrl: './drivers.component.html',
  styleUrl: './entities.scss',
})
export class DriversComponent implements OnInit {
  private api = inject(ApiService);
  items = signal<Driver[]>([]);
  showForm = signal(false);
  name = '';
  phone = '';
  licenseId = '';

  DRIVER_LABEL = DRIVER_LABEL;
  DRIVER_BADGE = DRIVER_BADGE;
  statuses: DriverStatus[] = ['AVAILABLE', 'WORKSHOP', 'NODOCS', 'PAUSED'];

  ngOnInit() {
    this.load();
  }
  load() {
    this.api.drivers().subscribe((d) => this.items.set(d));
  }
  create() {
    if (!this.name.trim()) return;
    this.api.createDriver({ name: this.name, phone: this.phone, licenseId: this.licenseId }).subscribe(() => {
      this.name = this.phone = this.licenseId = '';
      this.showForm.set(false);
      this.load();
    });
  }
  setStatus(d: Driver, status: DriverStatus) {
    this.api.updateDriver(d.id, { status }).subscribe(() => this.load());
  }
  remove(d: Driver) {
    if (confirm(`¿Eliminar a ${d.name}?`)) this.api.deleteDriver(d.id).subscribe(() => this.load());
  }
}
