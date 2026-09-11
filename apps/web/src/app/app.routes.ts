import { Routes } from '@angular/router';
import { authGuard, superGuard } from './core/guards';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'super/enterprises',
    canActivate: [authGuard, superGuard],
    loadComponent: () =>
      import('./pages/super/enterprises/enterprises.component').then((m) => m.SuperEnterprisesComponent),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'routes',
        loadComponent: () => import('./pages/routes/routes-list.component').then((m) => m.RoutesListComponent),
      },
      {
        path: 'routes/new',
        loadComponent: () => import('./pages/routes/route-create.component').then((m) => m.RouteCreateComponent),
      },
      {
        path: 'routes/:id',
        loadComponent: () => import('./pages/routes/route-detail.component').then((m) => m.RouteDetailComponent),
      },
      {
        path: 'tracking',
        loadComponent: () => import('./pages/tracking/tracking.component').then((m) => m.TrackingComponent),
      },
      {
        path: 'drivers',
        loadComponent: () => import('./pages/drivers/drivers.component').then((m) => m.DriversComponent),
      },
      {
        path: 'vehicles',
        loadComponent: () => import('./pages/vehicles/vehicles.component').then((m) => m.VehiclesComponent),
      },
      {
        path: 'clients',
        loadComponent: () => import('./pages/clients/clients.component').then((m) => m.ClientsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
