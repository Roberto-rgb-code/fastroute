import { Component, Input } from '@angular/core';

const PATHS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  route: 'M6 3a3 3 0 0 0-1 5.83V15a3 3 0 0 0 3 3h5.17A3 3 0 1 0 16 15h-5a1 1 0 0 1-1-1V8.83A3 3 0 0 0 6 3zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm12 12a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
  driver: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5c0-3-4-5.5-9-5.5z',
  vehicle: 'M3 13l2-6h14l2 6v6h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3v-6zm3-4l-1 3h14l-1-3H6z',
  client: 'M4 4h16v4H4V4zm0 6h16v10H4V10zm3 3v4h4v-4H7z',
  map: 'M15 4l-6 2-6-2v14l6 2 6-2 6 2V6l-6-2zm0 2.2l3 1v9.6l-3-1V6.2zM9 6.5l3-1v11l-3 1v-11z',
  building: 'M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v3h4a1 1 0 0 1 1 1v13H4zm4-3h2v-2H8v2zm0-4h2v-2H8v2zm0-4h2V8H8v2zm4 8h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V8h-2v2zm5 8h2v-2h-2v2zm0-4h2v-2h-2v2z',
  logout: 'M16 17l5-5-5-5v3H9v4h7v3zM4 4h8v2H6v12h6v2H4V4z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z',
  trash: 'M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2zM4 6h16v2H4V6z',
  check: 'M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.4-1.4z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 11h5v-2h-4V7h-2v6z',
  package: 'M12 2l9 4.5v11L12 22l-9-4.5v-11L12 2zm0 2.2L5.5 7.5 12 10.8l6.5-3.3L12 4.2zM5 9.3v6.5l6 3v-6.5l-6-3zm14 0l-6 3v6.5l6-3V9.3z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path [attr.d]="path" />
    </svg>
  `,
  styles: [':host{display:inline-flex;line-height:0}'],
})
export class IconComponent {
  @Input() name = 'dashboard';
  @Input() size = 20;
  get path() {
    return PATHS[this.name] ?? PATHS['dashboard'];
  }
}
