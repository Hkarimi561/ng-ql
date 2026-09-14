import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Product } from '../models/product.model';
import { ProductResource } from '../resources/product-resource';

/**
 * A real feature built on `ProductResource` — a Signal-backed, sorted,
 * paginated list, a create/edit form, and a one-click PATCH to toggle
 * `featured`.
 */
@Component({
  selector: 'app-product-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-manager.component.html',
  styleUrl: './product-manager.component.scss',
})
export class ProductManagerComponent {
  private readonly products = inject(ProductResource);

  protected readonly productsState = this.products.query().orderBy('name').paginateSignal(1, 5);

  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected form: Partial<Product> = this.emptyForm();

  private emptyForm(): Partial<Product> {
    return { name: '', category: 'Electronics', price: 0, stock: 0, featured: false };
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.formOpen.set(true);
  }

  startEdit(product: Product): void {
    this.editingId.set(product.id);
    this.form = {
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      featured: product.featured,
    };
    this.formOpen.set(true);
  }

  cancel(): void {
    this.formOpen.set(false);
  }

  save(): void {
    const id = this.editingId();
    this.saving.set(true);
    const request =
      id === null ? this.products.create(this.form) : this.products.update(id, this.form);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.productsState.refresh();
      },
      error: () => this.saving.set(false),
    });
  }

  toggleFeatured(product: Product): void {
    this.products
      .patch(product.id, { featured: !product.featured })
      .subscribe(() => this.productsState.refresh());
  }

  remove(id: number): void {
    this.products.destroy(id).subscribe(() => this.productsState.refresh());
  }

  setPage(page: number): void {
    if (page < 1) return;
    this.productsState.setPage(page);
  }
}
