import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="ph">
      <div>
        <h1 class="title-xl">{{ title }}</h1>
        @if (subtitle) {
          <p class="muted">{{ subtitle }}</p>
        }
      </div>
      <div class="ph-actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: [
    `
      .ph {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 1rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
      }
      .ph p {
        margin: 0.3rem 0 0;
      }
      .ph-actions {
        display: flex;
        gap: 0.6rem;
        align-items: center;
      }
    `,
  ],
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
