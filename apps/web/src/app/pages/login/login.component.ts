import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = 'admin@demo-logistica.local';
  password = 'Admin123!';
  error = signal<string | null>(null);
  loading = signal(false);

  fill(kind: 'super' | 'admin' | 'driver') {
    if (kind === 'super') {
      this.email = 'super@fastroute.local';
      this.password = 'SuperAdmin123!';
    } else if (kind === 'admin') {
      this.email = 'admin@demo-logistica.local';
      this.password = 'Admin123!';
    } else {
      this.email = 'conductor@demo-logistica.local';
      this.password = 'Driver123!';
    }
  }

  submit() {
    this.error.set(null);
    this.loading.set(true);
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        const role = this.auth.user()?.role;
        void this.router.navigate([role === 'SUPER' ? '/super/enterprises' : '/app/dashboard']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Credenciales inválidas');
      },
    });
  }
}
