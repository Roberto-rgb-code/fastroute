import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { Enterprise } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';

@Component({
  selector: 'app-super-enterprises',
  standalone: true,
  imports: [FormsModule, IconComponent],
  templateUrl: './enterprises.component.html',
  styleUrl: './enterprises.component.scss',
})
export class SuperEnterprisesComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  readonly auth = inject(AuthService);

  rows = signal<Enterprise[]>([]);
  message = signal<string | null>(null);

  // create enterprise
  name = '';
  slug = '';

  // create user modal
  activeEnt = signal<Enterprise | null>(null);
  uName = '';
  uEmail = '';
  uPassword = '';
  uRole = 'ADMIN';
  userMsg = signal<string | null>(null);

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api.enterprises().subscribe((d) => this.rows.set(d));
  }

  slugify() {
    this.slug = this.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  create() {
    this.message.set(null);
    if (!this.name.trim() || !this.slug.trim()) return;
    this.api.createEnterprise({ name: this.name, slug: this.slug }).subscribe({
      next: () => {
        this.name = this.slug = '';
        this.message.set('Empresa creada');
        this.reload();
      },
      error: (e) => this.message.set(e.error?.message ?? 'No se pudo crear'),
    });
  }

  toggleActive(e: Enterprise) {
    this.api.setEnterpriseActive(e.id, !e.isActive).subscribe(() => this.reload());
  }

  openUser(e: Enterprise) {
    this.activeEnt.set(e);
    this.uName = this.uEmail = this.uPassword = '';
    this.uRole = 'ADMIN';
    this.userMsg.set(null);
  }

  createUser() {
    const e = this.activeEnt();
    if (!e) return;
    this.userMsg.set(null);
    this.api
      .createEnterpriseUser(e.id, { name: this.uName, email: this.uEmail, password: this.uPassword, role: this.uRole })
      .subscribe({
        next: () => {
          this.userMsg.set('Usuario creado ✓');
          this.uName = this.uEmail = this.uPassword = '';
          this.reload();
        },
        error: (err) => this.userMsg.set(err.error?.message ?? 'Error al crear usuario'),
      });
  }

  goApp() {
    void this.router.navigate(['/app/dashboard']);
  }

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
