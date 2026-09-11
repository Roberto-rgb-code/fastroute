import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Client } from '../../core/models';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, IconComponent],
  templateUrl: './clients.component.html',
  styleUrl: '../drivers/entities.scss',
})
export class ClientsComponent implements OnInit {
  private api = inject(ApiService);
  items = signal<Client[]>([]);
  showForm = signal(false);
  name = '';
  contactName = '';
  contactPhone = '';

  ngOnInit() {
    this.load();
  }
  load() {
    this.api.clients().subscribe((c) => this.items.set(c));
  }
  create() {
    if (!this.name.trim()) return;
    this.api
      .createClient({ name: this.name, contactName: this.contactName, contactPhone: this.contactPhone })
      .subscribe(() => {
        this.name = this.contactName = this.contactPhone = '';
        this.showForm.set(false);
        this.load();
      });
  }
  remove(c: Client) {
    if (confirm(`¿Eliminar ${c.name}?`)) this.api.deleteClient(c.id).subscribe(() => this.load());
  }
}
