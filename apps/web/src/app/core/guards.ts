import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.token) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

/** Usuarios y configuración: solo SUPER y ADMIN. Espera a que /auth/me resuelva. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.ready()) {
    await new Promise<void>((resolve) => {
      const t = setInterval(() => {
        if (auth.ready()) {
          clearInterval(t);
          resolve();
        }
      }, 30);
    });
  }
  const role = auth.user()?.role;
  if (role === 'SUPER' || role === 'ADMIN') return true;
  return router.createUrlTree(['/app/dashboard']);
};

export const superGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.user()?.role === 'SUPER') {
    return true;
  }
  return router.createUrlTree(['/app']);
};
