/** The `Product` domain model. See {@link ProductResource} for how it's queried. */
export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  featured: boolean;
  createdAt: string;
}
