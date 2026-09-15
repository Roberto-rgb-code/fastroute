import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { DEMO_ROUTE_NAME } from '../../core/demo.config';
import { RouteSummary } from '../../core/models';
import { ROUTE_BADGE, ROUTE_LABEL } from '../../core/status';
import { IconComponent } from '../../shared/icon.component';
import { ModulePageComponent } from '../../shared/module-page.component';
import { RouteChatComponent } from '../../shared/route-chat.component';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, ModulePageComponent, RouteChatComponent],
  templateUrl: './messages.component.html',
})
export class MessagesComponent implements OnInit {
  private api = inject(ApiService);

  readonly ROUTE_LABEL = ROUTE_LABEL;
  readonly ROUTE_BADGE = ROUTE_BADGE;

  routes = signal<RouteSummary[]>([]);
  selectedId = signal<string | null>(null);
  loading = signal(true);

  ngOnInit() {
    this.api.today().subscribe((t) => {
      this.api.routes({ day: t.day }).subscribe({
        next: (list) => {
          const active = list.filter((r) => ['ENROUTE', 'PAUSED', 'CHECKLIST', 'CHECKLIST_PENDING', 'PENDING'].includes(r.status));
          this.routes.set(active.length ? active : list);
          const demo = active.find((r) => r.name === DEMO_ROUTE_NAME) ?? active[0] ?? list[0];
          this.selectedId.set(demo?.id ?? null);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });
  }

  tonePill(status: string): string {
    switch (ROUTE_BADGE[status]) {
      case 'ok':
        return 'bg-ok-bg text-ok';
      case 'warn':
        return 'bg-warn-bg text-warn';
      case 'danger':
        return 'bg-danger-bg text-danger';
      case 'info':
        return 'bg-info-bg text-info';
      default:
        return 'bg-ink-100 text-ink-500';
    }
  }
}
