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

export const superGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.user()?.role === 'SUPER') {
    return true;
  }
  return router.createUrlTree(['/app']);
};
