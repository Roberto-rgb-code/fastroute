import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';

/** Mapeo interno → Iconify (Solar duotone + line-md animados donde aporta). */
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

@Component({
  selector: 'app-icon',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <iconify-icon
      class="fr-icon"
      [attr.icon]="icon"
      [attr.width]="size"
      [attr.height]="size"
      aria-hidden="true"
    ></iconify-icon>
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
    `,
  ],
})
export class IconComponent {
  @Input() name = 'dashboard';
  @Input() size: number | string = 20;

  get icon(): string {
    return ICONIFY[this.name] ?? 'solar:widget-bold-duotone';
  }
}
