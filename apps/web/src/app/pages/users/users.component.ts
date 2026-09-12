import { SlicePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Driver, EnterpriseSettings, EnterpriseUser, UserRole } from '../../core/models';
import { ROLE_LABEL } from '../../core/status';
import { IconComponent } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, IconComponent, SlicePipe],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);
  readonly auth = inject(AuthService);

  items = signal<EnterpriseUser[]>([]);
  drivers = signal<Driver[]>([]);
  settings = signal<EnterpriseSettings | null>(null);
  showForm = signal(false);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);

  readonly ROLE_LABEL = ROLE_LABEL;
  readonly roles: UserRole[] = ['ADMIN', 'MANAGER', 'LOGISTICS', 'DRIVER', 'EXTERNAL'];
  readonly roleHelp: Record<string, string> = {
    ADMIN: 'Administra su empresa. Puede supervisar rutas de conductor.',
    MANAGER: 'Gestión operativa de la empresa.',
    LOGISTICS: 'Despacho y seguimiento.',
    DRIVER: 'Solo la app de campo; ve únicamente sus rutas.',
    EXTERNAL: 'Acceso limitado, no operador.',
  };

  name = '';
  email = '';
  password = '';
  role: UserRole = 'LOGISTICS';
  driverId = '';
  phone = '';

  ngOnInit() {
    this.load();
    this.api.drivers().subscribe((d) => this.drivers.set(d));
    this.api.settings().subscribe({ next: (s) => this.settings.set(s), error: () => null });
  }

  load() {
    this.api.users().subscribe((u) => this.items.set(u));
  }

  get limit(): number {
    return this.settings()?.max_users_per_ent ?? 0;
  }
  get limitReached(): boolean {
    return this.limit > 0 && this.items().length >= this.limit;
  }
  unlinkedDrivers() {
    const linked = new Set(this.items().map((u) => u.driver?.id).filter(Boolean));
    return this.drivers().filter((d) => !linked.has(d.id));
  }

  create() {
    this.error.set(null);
    if (!this.name.trim() || !this.email.trim() || this.password.length < 6) {
      this.error.set('Nombre, correo y contraseña (mín. 6) son obligatorios');
      return;
    }
    this.api
      .createUser({
        name: this.name,
        email: this.email,
        password: this.password,
        role: this.role,
        driverId: this.role === 'DRIVER' && this.driverId ? this.driverId : undefined,
        phone: this.phone || undefined,
      })
      .subscribe({
        next: () => {
          this.name = this.email = this.password = this.driverId = this.phone = '';
          this.showForm.set(false);
          this.flash('Usuario creado');
          this.load();
        },
        error: (e) => {
          const m = e?.error?.message;
          this.error.set(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo crear'));
        },
      });
  }

  toggleActive(u: EnterpriseUser) {
    this.api.updateUser(u.id, { isActive: !u.isActive }).subscribe(() => this.load());
  }

  changeRole(u: EnterpriseUser, role: UserRole) {
    this.api.updateUser(u.id, { role }).subscribe({ next: () => this.load(), error: (e) => this.error.set(e?.error?.message) });
  }

  resetPassword(u: EnterpriseUser) {
    const p = prompt(`Nueva contraseña para ${u.name} (mín. 6):`);
    if (!p || p.length < 6) return;
    this.api.updateUser(u.id, { password: p }).subscribe(() => this.flash('Contraseña actualizada'));
  }

  remove(u: EnterpriseUser) {
    if (u.id === this.auth.user()?.id) return;
    if (!confirm(`¿Eliminar a ${u.name}?`)) return;
    this.api.deleteUser(u.id).subscribe(() => this.load());
  }

  private flash(msg: string) {
    this.ok.set(msg);
    setTimeout(() => this.ok.set(null), 3000);
  }
}
