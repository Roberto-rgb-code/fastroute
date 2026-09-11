import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { AuthUser } from './models';

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'fastroute_token';
  private http = inject(HttpClient);
  readonly user = signal<AuthUser | null>(null);
  readonly ready = signal(false);

  readonly isSuper = computed(() => this.user()?.role === 'SUPER');

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
      }),
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.user.set(null);
  }
}
