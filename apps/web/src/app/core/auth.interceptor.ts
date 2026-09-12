import { HttpInterceptorFn } from '@angular/common/http';

const ACTIVE_ENTERPRISE_KEY = 'fastroute_enterprise';

/**
 * Añade el Bearer token y, para SUPER, el `enterpriseId` de la empresa activa
 * (RN-USR-03: el panel filtra todo por la empresa seleccionada).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('fastroute_token');
  if (!token) {
    return next(req);
  }
  const activeEnterprise = localStorage.getItem(ACTIVE_ENTERPRISE_KEY);
  const needsEnterprise =
    activeEnterprise &&
    req.url.startsWith('/api/v1') &&
    !req.url.startsWith('/api/v1/auth') &&
    !req.url.startsWith('/api/v1/super') &&
    !req.url.startsWith('/api/v1/config') &&
    !req.params.has('enterpriseId');

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
      setParams: needsEnterprise ? { enterpriseId: activeEnterprise } : undefined,
    }),
  );
};
