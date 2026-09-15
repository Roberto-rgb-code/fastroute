import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';

/**
 * Iconos desde Icônes / Iconify (https://icones.js.org/).
 * - default: Solar duotone
 * - animated=true (sidebar): line-md (trazos animados al montar / hover)
 */
const ICONIFY: Record<string, string> = {
  dashboard: 'solar:chart-square-bold-duotone',
  route: 'solar:routing-2-bold-duotone',
  template: 'solar:copy-bold-duotone',
  driver: 'solar:user-bold-duotone',
  users: 'solar:users-group-rounded-bold-duotone',
  vehicle: 'solar:bus-bold-duotone',
  client: 'solar:shop-bold-duotone',
  map: 'solar:map-point-wave-bold-duotone',
  pin: 'solar:map-point-bold-duotone',
  building: 'solar:buildings-bold-duotone',
  report: 'solar:chart-bold-duotone',
  settings: 'solar:settings-bold-duotone',
  checklist: 'solar:checklist-minimalistic-bold-duotone',
  logout: 'solar:logout-2-bold-duotone',
  plus: 'solar:add-circle-bold-duotone',
  trash: 'solar:trash-bin-trash-bold-duotone',
  check: 'solar:check-circle-bold-duotone',
  clock: 'solar:clock-circle-bold-duotone',
  package: 'solar:box-bold-duotone',
  chevron: 'solar:alt-arrow-right-bold',
  'chevron-down': 'solar:alt-arrow-down-bold',
  menu: 'solar:hamburger-menu-bold',
  collapse: 'solar:sidebar-minimalistic-bold-duotone',
  bell: 'solar:bell-bold-duotone',
  search: 'solar:magnifer-bold-duotone',
  copy: 'solar:copy-bold-duotone',
  x: 'solar:close-circle-bold-duotone',
  camera: 'solar:camera-bold-duotone',
  money: 'solar:wallet-money-bold-duotone',
  alert: 'solar:danger-triangle-bold-duotone',
  whatsapp: 'logos:whatsapp-icon',
  sms: 'solar:chat-round-line-bold-duotone',
  eye: 'solar:eye-bold-duotone',
  play: 'solar:play-bold',
  pause: 'solar:pause-bold',
  flag: 'solar:flag-bold-duotone',
  filter: 'solar:filter-bold-duotone',
  'trend-up': 'solar:graph-up-bold-duotone',
  'trend-down': 'solar:graph-down-bold-duotone',
  calendar: 'solar:calendar-bold-duotone',
  edit: 'solar:pen-bold-duotone',
  archive: 'solar:archive-bold-duotone',
  info: 'solar:info-circle-bold-duotone',
  more: 'solar:menu-dots-bold',
  gas: 'solar:gas-station-bold-duotone',
  speed: 'solar:speedometer-bold-duotone',
  sign: 'solar:signpost-bold-duotone',
};

/** Colección line-md en Icônes — animación de trazo. */
const LINE_MD: Record<string, string> = {
  dashboard: 'line-md:grid-3',
  route: 'line-md:navigation-right-up',
  template: 'line-md:document-list',
  map: 'line-md:map-marker-radius',
  report: 'line-md:chart',
  pin: 'line-md:map-marker',
  driver: 'line-md:account',
  vehicle: 'line-md:speedometer',
  client: 'line-md:briefcase',
  users: 'line-md:account-multiple',
  settings: 'line-md:cog',
  building: 'line-md:home',
  package: 'line-md:document-code',
  logout: 'line-md:logout',
  collapse: 'line-md:menu-fold-left',
  menu: 'line-md:menu',
  'chevron-down': 'line-md:chevron-small-down',
  chevron: 'line-md:chevron-small-right',
  bell: 'line-md:bell',
  plus: 'line-md:plus',
  check: 'line-md:confirm',
  search: 'line-md:search',
  calendar: 'line-md:calendar',
  alert: 'line-md:alert',
  edit: 'line-md:edit',
  trash: 'line-md:trash',
  x: 'line-md:close',
  eye: 'line-md:watch',
  info: 'line-md:alert-circle',
  copy: 'line-md:clipboard-check',
  camera: 'line-md:image',
  money: 'line-md:buy-me-a-coffee',
  play: 'line-md:play',
  pause: 'line-md:pause',
  filter: 'line-md:filter',
  archive: 'line-md:backup-restore',
  checklist: 'line-md:clipboard-list',
  gas: 'line-md:speedometer',
  speed: 'line-md:speedometer',
  sign: 'line-md:navigation-right',
  'trend-up': 'line-md:arrow-up',
  'trend-down': 'line-md:arrow-down',
  whatsapp: 'logos:whatsapp-icon',
  sms: 'line-md:chat',
  more: 'line-md:menu',
  clock: 'line-md:watch',
  flag: 'line-md:map-marker',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @if (tick >= 0) {
      <iconify-icon
        class="fr-icon"
        [class.fr-icon--nav]="animated"
        [attr.icon]="icon"
        [attr.width]="size"
        [attr.height]="size"
        aria-hidden="true"
      ></iconify-icon>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
      }
      .fr-icon {
        display: block;
        color: inherit;
        transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1), color 0.18s ease;
      }
      .fr-icon--nav {
        filter: drop-shadow(0 0 0 transparent);
      }
      :host-context(a:hover) .fr-icon--nav,
      :host-context(button:hover) .fr-icon--nav {
        transform: scale(1.12);
      }
    `,
  ],
  host: {
    '(mouseenter)': 'replay()',
  },
})
export class IconComponent {
  @Input() name = 'dashboard';
  @Input() size: number | string = 20;
  /** Usa iconos animados line-md de Icônes (sidebar). */
  @Input() animated = false;

  /** Remount key para re-disparar la animación de trazo en hover. */
  tick = 0;

  get icon(): string {
    if (this.animated) {
      return LINE_MD[this.name] ?? ICONIFY[this.name] ?? 'line-md:emoji-smile';
    }
    return ICONIFY[this.name] ?? 'solar:widget-bold-duotone';
  }

  replay() {
    if (!this.animated) return;
    this.tick = -1;
    void Promise.resolve().then(() => {
      this.tick = (this.tick < 0 ? 0 : this.tick) + 1;
    });
  }
}
