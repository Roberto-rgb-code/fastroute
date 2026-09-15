import { Component, Input } from '@angular/core';
import { IconComponent } from './icon.component';

/** Encabezado consistente para módulos del sidebar. */
@Component({
  selector: 'app-module-page',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="mx-auto flex w-full max-w-[1200px] flex-col gap-5 pb-8">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div class="flex items-start gap-3">
          @if (icon) {
            <span
              class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-sm"
            >
              <app-icon [name]="icon" [size]="22" />
            </span>
          }
          <div>
            <h1 class="text-xl font-bold text-ink-900">{{ title }}</h1>
            @if (subtitle) {
              <p class="text-sm text-ink-500">{{ subtitle }}</p>
            }
          </div>
        </div>
        <ng-content select="[actions]" />
      </header>
      <ng-content />
    </div>
  `,
})
export class ModulePageComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle = '';
  @Input() icon = '';
}
