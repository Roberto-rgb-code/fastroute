import { Component, Input } from '@angular/core';

const PATHS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  route: 'M6 3a3 3 0 0 0-1 5.83V15a3 3 0 0 0 3 3h5.17A3 3 0 1 0 16 15h-5a1 1 0 0 1-1-1V8.83A3 3 0 0 0 6 3zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm12 12a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
  template: 'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 3.5h7v2h-7v-2zm0-3.5h7v2h-7v-2zm0 7h7v2h-7v-2z',
  driver: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5c0-3-4-5.5-9-5.5z',
  users: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-3.3 0-6 1.7-6 4v2h8.5a5.5 5.5 0 0 1 2-4.6C11.4 13.5 9.8 13 8 13zm8 0c-3.3 0-6 1.7-6 4v2h12v-2c0-2.3-2.7-4-6-4z',
  vehicle: 'M3 13l2-6h14l2 6v6h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3v-6zm3-4l-1 3h14l-1-3H6z',
  client: 'M4 4h16v4H4V4zm0 6h16v10H4V10zm3 3v4h4v-4H7z',
  map: 'M15 4l-6 2-6-2v14l6 2 6-2 6 2V6l-6-2zm0 2.2l3 1v9.6l-3-1V6.2zM9 6.5l3-1v11l-3 1v-11z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z',
  building: 'M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v3h4a1 1 0 0 1 1 1v13H4zm4-3h2v-2H8v2zm0-4h2v-2H8v2zm0-4h2V8H8v2zm4 8h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V8h-2v2zm5 8h2v-2h-2v2zm0-4h2v-2h-2v2z',
  report: 'M5 3h10l4 4v14H5V3zm9 1.5V8h3.5L14 4.5zM8 12h2v6H8v-6zm3-3h2v9h-2V9zm3 5h2v4h-2v-4z',
  settings: 'M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.7 7.7 0 0 0-1.7-1L15 3H9l-.3 2.9a7.7 7.7 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L9 21h6l.3-2.9c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5L19.4 13zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  checklist: 'M4 5h2v2H4V5zm4 0h12v2H8V5zM4 11h2v2H4v-2zm4 0h12v2H8v-2zm-4 6h2v2H4v-2zm4 0h12v2H8v-2z',
  logout: 'M16 17l5-5-5-5v3H9v4h7v3zM4 4h8v2H6v12h6v2H4V4z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z',
  trash: 'M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2zM4 6h16v2H4V6z',
  check: 'M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.4-1.4z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 11h5v-2h-4V7h-2v6z',
  package: 'M12 2l9 4.5v11L12 22l-9-4.5v-11L12 2zm0 2.2L5.5 7.5 12 10.8l6.5-3.3L12 4.2zM5 9.3v6.5l6 3v-6.5l-6-3zm14 0l-6 3v6.5l6-3V9.3z',
  chevron: 'M8.6 5.6 7.2 7l5 5-5 5 1.4 1.4L15 12z',
  'chevron-down': 'M5.6 8.6 7 7.2l5 5 5-5 1.4 1.4L12 15z',
  menu: 'M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z',
  collapse: 'M11 5H3v2h8V5zm0 4H3v2h8V9zm0 4H3v2h8v-2zm0 4H3v2h8v-2zm5-9 4 4-4 4v-8z',
  bell: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z',
  search: 'M10 2a8 8 0 1 1 4.9 14.3l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
  copy: 'M8 3h11v13h-2V5H8V3zM5 7h11v14H5V7zm2 2v10h7V9H7z',
  x: 'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L12 13.4l-6.3 6.3-1.4-1.4L10.6 12 4.3 5.7l1.4-1.4L12 10.6l6.3-6.3z',
  camera: 'M9 3h6l1.5 2H20a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3.5L9 3zm3 5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  money: 'M3 6h18v12H3V6zm2 2v8h14V8H5zm7 1a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  alert: 'M12 2 1 21h22L12 2zm0 6 6.5 11h-13L12 8zm-1 4v3h2v-3h-2zm0 4v2h2v-2h-2z',
  whatsapp: 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.6.7.7-2.5-.2-.3A8 8 0 0 1 12 4zm-3 4.5c-.2 0-.6.1-.9.4-.3.4-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.2.2 2.2 3.4 5.4 4.6 2.6 1 3.2.8 3.7.8.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4l-2-1c-.3-.1-.5-.2-.7.1l-1 1.2c-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5l-.9-2.1c-.2-.6-.5-.5-.7-.5H9z',
  sms: 'M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1h-1zm3 4v2h10V8H7zm0 4v2h7v-2H7z',
  eye: 'M12 5C7 5 3 8 1 12c2 4 6 7 11 7s9-3 11-7c-2-4-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  flag: 'M5 3h2v18H5V3zm3 1h11l-2 4 2 4H8V4z',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  'trend-up': 'M4 17l6-6 3 3 7-8v3.5h2V4h-7v2h3.1l-5.1 5.9-3-3L2 15.6 4 17z',
  'trend-down': 'M4 7l6 6 3-3 7 8V15h2v7h-7v-2h3.1L13 14.1l-3 3L2 8.4 4 7z',
  calendar: 'M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2zM5 9v10h14V9H5z',
  edit: 'M3 17.3V21h3.7L17.8 9.9l-3.7-3.7L3 17.3zm17.7-10.2a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0L15 5.2l3.7 3.7 1.9-1.8z',
  archive: 'M3 4h18v4H3V4zm1 5h16v11H4V9zm5 2v2h6v-2H9z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v2h-2V7zm0 4h2v6h-2v-6z',
  more: 'M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  gas: 'M4 3h9a1 1 0 0 1 1 1v6h1a2 2 0 0 1 2 2v5a1 1 0 1 0 2 0V9.4l-2-2V5h2l2 2v10a3 3 0 1 1-6 0v-5h-1v9H4V3zm2 2v5h5V5H6z',
  speed: 'M12 4a9 9 0 0 0-9 9c0 2.3.9 4.5 2.4 6h13.2A9 9 0 0 0 12 4zm0 2a7 7 0 0 1 6.3 4H5.7A7 7 0 0 1 12 6zm-1 8.5 5.5-5.5 1.4 1.4-5.5 5.5A1.5 1.5 0 1 1 11 14.5z',
  sign: 'M3 17l6.5-6.5 3 3L21 5l-1.4-1.4-7.1 7.1-3-3L2 15.6 3 17zm0 3h18v-2H3v2z',
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
  styles: [':host{display:inline-flex;line-height:0;flex-shrink:0}'],
})
export class IconComponent {
  @Input() name = 'dashboard';
  @Input() size = 20;
  get path() {
    return PATHS[this.name] ?? PATHS['dashboard'];
  }
}
