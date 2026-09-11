import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { IconComponent } from '../shared/icon.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  private router = inject(Router);

  nav: NavItem[] = [
    { path: '/app/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/app/routes', label: 'Rutas', icon: 'route' },
    { path: '/app/tracking', label: 'Seguimiento', icon: 'map' },
    { path: '/app/drivers', label: 'Conductores', icon: 'driver' },
    { path: '/app/vehicles', label: 'Vehículos', icon: 'vehicle' },
    { path: '/app/clients', label: 'Clientes', icon: 'client' },
  ];

  get initials(): string {
    const n = this.auth.user()?.name ?? '?';
    return n
      .split(' ')
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase();
  }

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
