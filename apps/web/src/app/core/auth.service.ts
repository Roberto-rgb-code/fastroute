import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { AuthUser, UserRole } from './models';

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

const ENTERPRISE_KEY = 'fastroute_enterprise';
const ENTERPRISE_NAME_KEY = 'fastroute_enterprise_name';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'fastroute_token';
  private http = inject(HttpClient);
  readonly user = signal<AuthUser | null>(null);
  readonly ready = signal(false);

  /** Empresa activa (SUPER puede cambiarla; los demás usan la propia). */
  readonly activeEnterpriseId = signal<string | null>(localStorage.getItem(ENTERPRISE_KEY));
  readonly activeEnterpriseName = signal<string | null>(localStorage.getItem(ENTERPRISE_NAME_KEY));

  readonly isSuper = computed(() => this.user()?.role === 'SUPER');
  readonly role = computed<UserRole | null>(() => this.user()?.role ?? null);
  readonly isAdmin = computed(() => ['SUPER', 'ADMIN'].includes(this.user()?.role ?? ''));
  readonly canDispatch = computed(() =>
    ['SUPER', 'ADMIN', 'MANAGER', 'LOGISTICS'].includes(this.user()?.role ?? ''),
  );
  readonly enterpriseLabel = computed(
    () => this.activeEnterpriseName() ?? this.user()?.enterpriseName ?? 'Logística',
  );

  constructor() {
    const token = localStorage.getItem(this.tokenKey);
    if (token) {
      this.http.get<AuthUser>('/api/v1/auth/me').subscribe({
        next: (u) => {
          this.user.set(u);
          this.ready.set(true);
        },
        error: () => {
          this.logout();
          this.ready.set(true);
        },
      });
    } else {
      this.ready.set(true);
    }
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>('/api/v1/auth/login', { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(this.tokenKey, res.accessToken);
        this.user.set(res.user);
        if (res.user.role !== 'SUPER') this.setActiveEnterprise(null, null);
      }),
    );
  }

  setActiveEnterprise(id: string | null, name: string | null) {
    if (id) {
      localStorage.setItem(ENTERPRISE_KEY, id);
      localStorage.setItem(ENTERPRISE_NAME_KEY, name ?? '');
    } else {
      localStorage.removeItem(ENTERPRISE_KEY);
      localStorage.removeItem(ENTERPRISE_NAME_KEY);
    }
    this.activeEnterpriseId.set(id);
    this.activeEnterpriseName.set(name);
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.setActiveEnterprise(null, null);
    this.user.set(null);
  }
}
