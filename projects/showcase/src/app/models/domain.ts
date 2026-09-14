// The domain models themselves live in their own files (one per resource) —
// see post.model.ts, user.model.ts, product.model.ts. Everything below is
// UI-only metadata used to drive the showcase's generic query-builder form;
// it is not something a real ng-ql consumer needs.
export type { Post } from './post.model';
export type { User } from './user.model';
export type { Product } from './product.model';

export type ResourceKind = 'posts' | 'users' | 'products';

export interface FieldDef {
  readonly name: string;
  readonly label: string;
  readonly type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  readonly enumValues?: readonly string[];
}

export interface ResourceDef {
  readonly kind: ResourceKind;
  readonly label: string;
  readonly endpoint: string;
  readonly fields: readonly FieldDef[];
  readonly relations: readonly string[];
}

export const RESOURCE_DEFS: Record<ResourceKind, ResourceDef> = {
  posts: {
    kind: 'posts',
    label: 'Posts',
    endpoint: 'posts',
    relations: ['author', 'category', 'comments'],
    fields: [
      { name: 'id', label: 'ID', type: 'number' },
      { name: 'title', label: 'Title', type: 'string' },
      {
        name: 'status',
        label: 'Status',
        type: 'enum',
        enumValues: ['draft', 'published', 'archived'],
      },
      { name: 'categoryId', label: 'Category ID', type: 'number' },
      { name: 'authorId', label: 'Author ID', type: 'number' },
      { name: 'views', label: 'Views', type: 'number' },
      { name: 'createdAt', label: 'Created At', type: 'date' },
    ],
  },
  users: {
    kind: 'users',
    label: 'Users',
    endpoint: 'users',
    relations: ['posts', 'roles'],
    fields: [
      { name: 'id', label: 'ID', type: 'number' },
      { name: 'name', label: 'Name', type: 'string' },
      { name: 'email', label: 'Email', type: 'string' },
      { name: 'role', label: 'Role', type: 'enum', enumValues: ['admin', 'editor', 'viewer'] },
      { name: 'active', label: 'Active', type: 'boolean' },
      { name: 'createdAt', label: 'Created At', type: 'date' },
    ],
  },
  products: {
    kind: 'products',
    label: 'Products',
    endpoint: 'products',
    relations: ['category', 'reviews'],
    fields: [
      { name: 'id', label: 'ID', type: 'number' },
      { name: 'name', label: 'Name', type: 'string' },
      { name: 'category', label: 'Category', type: 'string' },
      { name: 'price', label: 'Price', type: 'number' },
      { name: 'stock', label: 'Stock', type: 'number' },
      { name: 'featured', label: 'Featured', type: 'boolean' },
      { name: 'createdAt', label: 'Created At', type: 'date' },
    ],
  },
};
