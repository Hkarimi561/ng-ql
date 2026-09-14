/** The `User` domain model. See {@link UserResource} for how it's queried. */
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  active: boolean;
  createdAt: string;
}
