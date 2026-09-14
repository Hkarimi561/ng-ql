import type { Post, Product, User } from '../models/domain';

function daysAgo(n: number): string {
  const d = new Date(Date.UTC(2026, 0, 1));
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

const POST_TITLES = [
  'Understanding Angular Signals',
  'A Deep Dive into RxJS',
  'Building Type-Safe APIs',
  'Query Builders Done Right',
  'Caching Strategies for SPAs',
  'Server-Side Rendering Explained',
  'Standalone Components Guide',
  'Effective Change Detection',
  'Designing REST Endpoints',
  'Testing Angular Apps',
];

export function generatePosts(count = 47): Post[] {
  const statuses: Post['status'][] = ['draft', 'published', 'archived'];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `${POST_TITLES[i % POST_TITLES.length]} #${i + 1}`,
    status: statuses[i % statuses.length],
    categoryId: (i % 5) + 1,
    authorId: (i % 8) + 1,
    views: (i * 37) % 5000,
    createdAt: daysAgo(count - i),
  }));
}

const FIRST_NAMES = [
  'Ava',
  'Liam',
  'Noah',
  'Emma',
  'Olivia',
  'Mia',
  'Lucas',
  'Sofia',
  'Ethan',
  'Zoe',
];
const LAST_NAMES = ['Smith', 'Johnson', 'Lee', 'Brown', 'Garcia', 'Martinez', 'Davis', 'Wilson'];

export function generateUsers(count = 33): User[] {
  const roles: User['role'][] = ['admin', 'editor', 'viewer'];
  return Array.from({ length: count }, (_, i) => {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[i % LAST_NAMES.length];
    return {
      id: i + 1,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      role: roles[i % roles.length],
      active: i % 4 !== 0,
      createdAt: daysAgo(count - i),
    };
  });
}

const PRODUCT_NAMES = [
  'Widget',
  'Gadget',
  'Gizmo',
  'Doohickey',
  'Contraption',
  'Apparatus',
  'Device',
  'Module',
];
const CATEGORIES = ['Electronics', 'Home', 'Office', 'Outdoor', 'Toys'];

export function generateProducts(count = 60): Product[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `${PRODUCT_NAMES[i % PRODUCT_NAMES.length]} ${String.fromCharCode(65 + (i % 26))}`,
    category: CATEGORIES[i % CATEGORIES.length],
    price: Math.round((10 + ((i * 13.7) % 490)) * 100) / 100,
    stock: (i * 7) % 200,
    featured: i % 6 === 0,
    createdAt: daysAgo(count - i),
  }));
}
