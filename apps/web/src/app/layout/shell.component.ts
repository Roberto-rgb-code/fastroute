import { Component, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Enterprise, UserRole } from '../core/models';
import { IconComponent } from '../shared/icon.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles?: UserRole[];
  badge?: () => number | null;
}

interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
  roles?: UserRole[];
}

const COLLAPSED_KEY = 'fastroute_sidebar_collapsed';
const GROUPS_KEY = 'fastroute_sidebar_groups';

const ROLE_LABEL: Record<string, string> = {
  SUPER: 'Super Admin',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  LOGISTICS: 'Logística',
  DRIVER: 'Conductor',
  EXTERNAL: 'Externo',
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, FormsModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  private router = inject(Router);
  private api = inject(ApiService);

  /** Rail colapsado (solo iconos). */
  collapsed = signal(localStorage.getItem(COLLAPSED_KEY) === '1');
  /** Drawer móvil abierto. */
  mobileOpen = signal(false);
  /** Grupos desplegados. */
  openGroups = signal<Record<string, boolean>>(this.loadGroups());
  /** Menú de usuario. */
  userMenu = signal(false);

  enterprises = signal<Enterprise[]>([]);
  pendingApprovals = signal<number | null>(null);
  today = signal<string>('');

  readonly ROLE_LABEL = ROLE_LABEL;

  groups: NavGroup[] = [
    {
      id: 'inicio',
      label: 'Inicio',
      icon: 'dashboard',
      items: [
        { path: '/app/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { path: '/app/routes', label: 'Rutas del día', icon: 'route', badge: () => this.pendingApprovals() },
        { path: '/app/templates', label: 'Plantillas de ruta', icon: 'template' },
        { path: '/app/tracking', label: 'Seguimiento', icon: 'map' },
        { path: '/app/weather', label: 'Clima', icon: 'weather' },
        { path: '/app/messages', label: 'Mensajes', icon: 'message' },
        { path: '/app/reports', label: 'Reportes', icon: 'report', roles: ['SUPER', 'ADMIN', 'MANAGER', 'LOGISTICS'] },
        { path: '/app/history', label: 'Historial', icon: 'history', roles: ['SUPER', 'ADMIN', 'MANAGER', 'LOGISTICS'] },
      ],
    },
    {
      id: 'operacion',
      label: 'Operación',
      icon: 'package',
      items: [
        { path: '/app/stops', label: 'Paradas', icon: 'pin' },
        { path: '/app/drivers', label: 'Operadores', icon: 'driver' },
        { path: '/app/vehicles', label: 'Unidades', icon: 'vehicle' },
        { path: '/app/clients', label: 'Clientes y checklist', icon: 'client' },
      ],
    },
    {
      id: 'admin',
      label: 'Administración',
      icon: 'settings',
      roles: ['SUPER', 'ADMIN'],
      items: [
        { path: '/app/users', label: 'Usuarios', icon: 'users' },
        { path: '/app/settings', label: 'Configuración', icon: 'settings' },
      ],
    },
    {
      id: 'super',
      label: 'Plataforma',
      icon: 'building',
      roles: ['SUPER'],
      items: [{ path: '/super/enterprises', label: 'Empresas', icon: 'building' }],
    },
  ];

  visibleGroups = computed(() => {
    const role = this.auth.role();
    if (!role) return [];
    return this.groups
      .filter((g) => !g.roles || g.roles.includes(role))
      .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) }))
      .filter((g) => g.items.length);
  });

  constructor() {
    effect(() => localStorage.setItem(COLLAPSED_KEY, this.collapsed() ? '1' : '0'));
    effect(() => localStorage.setItem(GROUPS_KEY, JSON.stringify(this.openGroups())));
  }

  ngOnInit() {
    this.api.today().subscribe((t) => this.today.set(t.day));
    this.refreshBadges();
    if (this.auth.isSuper()) {
      this.api.enterprises().subscribe((list) => {
        this.enterprises.set(list);
        if (!this.auth.activeEnterpriseId() && list.length) {
          this.auth.setActiveEnterprise(list[0].id, list[0].name);
        }
      });
    }
  }

  refreshBadges() {
    if (this.auth.role() === 'DRIVER') return;
    this.api.kpis().subscribe({
      next: (k) => this.pendingApprovals.set(k.pendingApprovals || null),
      error: () => this.pendingApprovals.set(null),
    });
  }

  get initials(): string {
    const n = this.auth.user()?.name ?? '?';
    return n
      .split(' ')
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase();
  }

  /** Rail de iconos (en móvil el drawer siempre va expandido). */
  rail(): boolean {
    return this.collapsed() && !this.mobileOpen();
  }

  isOpen(id: string) {
    return this.openGroups()[id] !== false;
  }

  toggleGroup(id: string) {
    if (this.collapsed()) {
      this.collapsed.set(false);
      this.openGroups.update((g) => ({ ...g, [id]: true }));
      return;
    }
    this.openGroups.update((g) => ({ ...g, [id]: !this.isOpen(id) }));
  }

  toggleCollapsed() {
    this.collapsed.update((v) => !v);
  }

  toggleUserMenu() {
    this.userMenu.update((v) => !v);
  }

  toggleMobile() {
    this.mobileOpen.update((v) => !v);
  }

  closeMobile() {
    this.mobileOpen.set(false);
  }

  switchEnterprise(id: string) {
    const ent = this.enterprises().find((e) => e.id === id);
    this.auth.setActiveEnterprise(id, ent?.name ?? null);
    // Recarga la vista para que todos los datos tomen la nueva empresa.
    const url = this.router.url;
    void this.router.navigateByUrl('/app', { skipLocationChange: true }).then(() => this.router.navigateByUrl(url));
  }

  formatDay(day: string): string {
    if (!day) return '';
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.userMenu.set(false);
    this.mobileOpen.set(false);
  }

  private loadGroups(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '{}');
    } catch {
      return {};
    }
  }
}
