import { Injectable } from '@angular/core';
import { NgQlClient, NgQlResource } from 'ng-ql';
import type { Product } from '../models/product.model';

/**
 * Typed ng-ql resource for the `/products` endpoint.
 *
 * ```ts
 * private readonly products = inject(ProductResource);
 *
 * // Observable: range filter + field selection
 * this.products
 *   .query()
 *   .whereBetween('price', [10, 50])
 *   .select(['id', 'name', 'price'])
 *   .get()
 *   .subscribe((cheapProducts) => console.log(cheapProducts));
 *
 * // Signal: paginated, network-first (falls back to cache if the request fails)
 * protected readonly catalog = this.products
 *   .query()
 *   .orderBy('name')
 *   .paginateSignal(1, 24, { cache: 'network-first' });
 *
 * // CRUD
 * this.products.create({ name: 'Widget', category: 'Home', price: 19.99, stock: 100, featured: false });
 * this.products.update(3, { name: 'Widget Pro', category: 'Home', price: 24.99, stock: 80, featured: true });
 * this.products.destroy(3).subscribe();
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ProductResource extends NgQlResource<Product, number> {
  constructor(client: NgQlClient) {
    super(client, { endpoint: 'products', cacheTags: ['products'] });
  }
}
