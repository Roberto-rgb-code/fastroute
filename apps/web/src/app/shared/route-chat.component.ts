import {
  AfterViewChecked,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import Pusher from 'pusher-js';
import { ApiService } from '../core/api.service';
import { Message } from '../core/models';
import { IconComponent } from './icon.component';

/**
 * Chat por ruta: panel web (admin/logística) que conversa con el conductor
 * en la app mobile. Tiempo real vía Pusher (canal `route-<id>`, evento `message`).
 */
@Component({
  selector: 'app-route-chat',
  standalone: true,
  imports: [FormsModule, DatePipe, IconComponent],
  template: `
    <div class="flex h-full flex-col">
      <div #scroll class="flex-1 space-y-2 overflow-y-auto px-1 py-2">
        @if (loading()) {
          <p class="py-6 text-center text-xs text-ink-400">Cargando conversación…</p>
        } @else if (!messages().length) {
          <div class="flex flex-col items-center gap-2 py-10 text-center text-ink-400">
            <app-icon name="message" [size]="28" />
            <p class="text-xs">Aún no hay mensajes. Escribe al conductor.</p>
          </div>
        }
        @for (m of messages(); track m.id) {
          <div class="flex" [class.justify-end]="m.sender === 'ADMIN'">
            <div
              class="max-w-[80%] rounded-2xl px-3 py-2 text-[13px] shadow-sm"
              [class.bg-brand-600]="m.sender === 'ADMIN'"
              [class.text-white]="m.sender === 'ADMIN'"
              [class.bg-white]="m.sender !== 'ADMIN'"
              [class.text-ink-800]="m.sender !== 'ADMIN'"
              [class.border]="m.sender !== 'ADMIN'"
              [class.border-ink-200]="m.sender !== 'ADMIN'"
            >
              <p class="whitespace-pre-wrap break-words">{{ m.body }}</p>
              <p
                class="mt-0.5 text-[10px] opacity-70"
                [class.text-white]="m.sender === 'ADMIN'"
                [class.text-ink-400]="m.sender !== 'ADMIN'"
              >
                {{ m.sender === 'ADMIN' ? (m.user?.name ?? 'Central') : 'Conductor' }} ·
                {{ m.createdAt | date: 'shortTime' }}
              </p>
            </div>
          </div>
        }
      </div>

      <form class="flex items-end gap-2 border-t border-ink-100 p-2" (ngSubmit)="send()">
        <textarea
          [(ngModel)]="draft"
          name="draft"
          rows="1"
          placeholder="Escribe un mensaje al conductor…"
          class="max-h-24 min-h-[38px] flex-1 resize-none rounded-lg border border-ink-200 px-3 py-2 text-[13px] focus:border-brand-500 focus:outline-none"
          (keydown.enter)="onEnter($event)"
        ></textarea>
        <button
          type="submit"
          class="grid h-[38px] w-[38px] place-items-center rounded-lg bg-brand-600 text-white disabled:opacity-40"
          [disabled]="!draft.trim() || sending()"
          title="Enviar"
        >
          <app-icon name="navigation" [size]="18" />
        </button>
      </form>
    </div>
  `,
})
export class RouteChatComponent implements OnChanges, AfterViewChecked, OnDestroy {
  private api = inject(ApiService);

  @Input({ required: true }) routeId!: string;
  @ViewChild('scroll') scrollEl?: ElementRef<HTMLDivElement>;

  readonly messages = signal<Message[]>([]);
  readonly loading = signal(false);
  readonly sending = signal(false);
  draft = '';

  private pusher?: Pusher;
  private boundRoute?: string;
  private shouldScroll = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['routeId'] && this.routeId && this.routeId !== this.boundRoute) {
      this.load();
      void this.subscribe();
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll && this.scrollEl) {
      this.scrollEl.nativeElement.scrollTop = this.scrollEl.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  ngOnDestroy() {
    this.teardown();
  }

  private load() {
    this.loading.set(true);
    this.api.routeMessages(this.routeId).subscribe({
      next: (msgs) => {
        this.messages.set(msgs);
        this.loading.set(false);
        this.shouldScroll = true;
        this.api.markMessagesRead(this.routeId).subscribe({ error: () => null });
      },
      error: () => this.loading.set(false),
    });
  }

  private async subscribe() {
    this.teardown();
    this.boundRoute = this.routeId;
    try {
      const cfg = await firstValueFrom(this.api.clientConfig());
      const key = cfg.pusher?.key?.trim();
      if (!key) return;
      this.pusher = new Pusher(key, { cluster: cfg.pusher.cluster || 'us2' });
      const channel = this.pusher.subscribe(`route-${this.routeId}`);
      channel.bind('message', (msg: Message) => {
        if (msg.routeId !== this.routeId) return;
        this.messages.update((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]));
        this.shouldScroll = true;
        if (msg.sender === 'DRIVER') {
          this.api.markMessagesRead(this.routeId).subscribe({ error: () => null });
        }
      });
    } catch {
      /* opcional: sin realtime seguimos con envío/recepción manual */
    }
  }

  private teardown() {
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = undefined;
    }
  }

  onEnter(ev: Event) {
    const e = ev as KeyboardEvent;
    if (!e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  send() {
    const body = this.draft.trim();
    if (!body || this.sending()) return;
    this.sending.set(true);
    this.api.sendMessage(this.routeId, body).subscribe({
      next: (msg) => {
        this.messages.update((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]));
        this.draft = '';
        this.sending.set(false);
        this.shouldScroll = true;
      },
      error: () => this.sending.set(false),
    });
  }
}
