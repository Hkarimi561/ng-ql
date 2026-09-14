/**
 * The `Post` domain model.
 *
 * ng-ql is not an ORM — this interface is a plain shape for the JSON your API
 * returns. There's no base class to extend and no decorators to apply; any
 * TypeScript interface works as a model for {@link PostResource}.
 */
export interface Post {
  id: number;
  title: string;
  status: 'draft' | 'published' | 'archived';
  categoryId: number;
  authorId: number;
  views: number;
  createdAt: string;
}
