import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Driver, DriverStatus } from '../../core/models';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';
import { EntityViewToggleComponent } from '../../shared/entity-view-toggle.component';
import { loadEntityView } from '../../shared/entity-view';
import { DRIVER_BADGE, DRIVER_LABEL } from '../../core/status';

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, IconComponent, EntityViewToggleComponent],
  templateUrl: './drivers.component.html',
  styleUrl: './entities.scss',
})
export class DriversComponent implements OnInit {
  private api = inject(ApiService);
  items = signal<Driver[]>([]);
  showForm = signal(false);
  viewMode = signal(loadEntityView('drivers'));
  name = '';
  phone = '';
  licenseId = '';
  licenseExpiry = '';

  DRIVER_LABEL = DRIVER_LABEL;
  DRIVER_BADGE = DRIVER_BADGE;
  /** RN-DRV-05: estados manuales; los demás los gobierna la ruta. */
  statuses: DriverStatus[] = ['AVAILABLE', 'WORKSHOP', 'NODOCS', 'UNAVAILABLE', 'PAUSED'];
  routeDriven(s: DriverStatus) {
    return ['ENROUTE', 'CHECKLIST', 'CHECKLIST_PENDING'].includes(s);
  }
  docsExpired(d: Driver) {
    const now = Date.now();
    return [d.licenseExpiry, d.idDocExpiry].some((x) => x && new Date(x).getTime() < now);
  }

  ngOnInit() {
    this.load();
  }
  load() {
    this.api.drivers().subscribe((d) => this.items.set(d));
  }
  create() {
    if (!this.name.trim()) return;
    this.api
      .createDriver({
        name: this.name,
        phone: this.phone,
        licenseId: this.licenseId,
        licenseExpiry: this.licenseExpiry ? new Date(this.licenseExpiry).toISOString() : undefined,
      })
      .subscribe(() => {
      this.name = this.phone = this.licenseId = this.licenseExpiry = '';
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
