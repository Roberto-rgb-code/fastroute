import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import Pusher from 'pusher-js';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  routeId?: string;
  href?: string;
  createdAt: string;
  read: boolean;
}

const STORAGE_KEY = 'fastroute_notifications_read';

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private pusher?: InstanceType<typeof Pusher>;
  private channel?: ReturnType<InstanceType<typeof Pusher>['subscribe']>;
  private readIds = new Set<string>(this.loadReadIds());

  readonly items = signal<AppNotification[]>([]);
  readonly open = signal(false);

  readonly unreadCount = () => this.items().filter((n) => !n.read).length;

  async connect() {
    if (this.pusher || this.auth.role() === 'DRIVER') return;
    const eid = this.auth.user()?.enterpriseId ?? this.auth.activeEnterpriseId();
    if (!eid) return;

    const cfg = await firstValueFrom(this.api.clientConfig());
    const key = cfg?.pusher?.key?.trim();
    if (!key) return;

    this.pusher = new Pusher(key, { cluster: cfg.pusher.cluster || 'us2' });
    this.channel = this.pusher.subscribe(`enterprise-${eid}`);
    this.channel.bind('notification', (payload: Omit<AppNotification, 'read'>) => {
      this.push(payload);
    });
    this.channel.bind('message', (msg: { id: string; body: string; routeId: string; sender: string }) => {
      if (msg.sender === 'ADMIN') return;
      this.push({
        id: `msg-${msg.id}`,
        type: 'message',
        title: 'Nuevo mensaje',
        body: msg.body.slice(0, 120),
        routeId: msg.routeId,
        href: '/app/messages',
        createdAt: new Date().toISOString(),
      });
    });
  }

  disconnect() {
    this.channel?.unbind_all();
    this.pusher?.disconnect();
    this.channel = undefined;
    this.pusher = undefined;
  }

  ngOnDestroy() {
    this.disconnect();
  }

  togglePanel() {
    this.open.update((v) => !v);
  }

  closePanel() {
    this.open.set(false);
  }

  markAllRead() {
    for (const n of this.items()) {
      this.readIds.add(n.id);
    }
    this.persistRead();
    this.items.update((list) => list.map((n) => ({ ...n, read: true })));
  }

  markRead(id: string) {
    this.readIds.add(id);
    this.persistRead();
    this.items.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  private push(partial: Omit<AppNotification, 'read'>) {
    const n: AppNotification = {
      ...partial,
      read: this.readIds.has(partial.id),
    };
    this.items.update((list) => [n, ...list].slice(0, 40));
  }

  private loadReadIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }

  private persistRead() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.readIds]));
  }
}
