import { Component, effect, input, model } from '@angular/core';
import { IconComponent } from './icon.component';
import { EntityViewMode, saveEntityView } from './entity-view';

@Component({
  selector: 'app-entity-view-toggle',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="view-toggle" role="group" aria-label="Modo de vista">
      <button
        type="button"
        class="view-toggle-btn"
        [class.on]="mode() === 'cards'"
        (click)="pick('cards')"
        title="Vista en tarjetas"
      >
        <app-icon name="layout-grid" [size]="18" />
      </button>
      <button
        type="button"
        class="view-toggle-btn"
        [class.on]="mode() === 'list'"
        (click)="pick('list')"
        title="Vista en lista"
      >
        <app-icon name="layout-list" [size]="18" />
      </button>
    </div>
  `,
  styles: [
    `
      .view-toggle {
        display: inline-flex;
        padding: 3px;
        border-radius: 10px;
        background: var(--ink-100);
        border: 1px solid var(--ink-200);
        gap: 2px;
      }
      .view-toggle-btn {
        display: grid;
        place-items: center;
        width: 36px;
        height: 32px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--ink-500);
        cursor: pointer;
        transition:
          background 0.15s ease,
          color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .view-toggle-btn:hover {
        color: var(--ink-800);
      }
      .view-toggle-btn.on {
        background: #fff;
        color: var(--brand-600);
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
      }
    `,
  ],
})
export class EntityViewToggleComponent {
  /** Persiste preferencia por módulo (drivers, vehicles, …). */
  storageKey = input<string | null>(null);
  mode = model<EntityViewMode>('cards');

  constructor() {
    effect(() => {
      const key = this.storageKey();
      const m = this.mode();
      if (key) saveEntityView(key, m);
    });
  }

  pick(m: EntityViewMode) {
    this.mode.set(m);
  }
}
