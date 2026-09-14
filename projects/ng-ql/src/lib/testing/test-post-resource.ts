import { Injectable } from '@angular/core';
import { NgQlClient } from '../client/ng-ql-client';
import { NgQlEndpoint } from '../resource/ng-ql-endpoint.decorator';
import { NgQlResource } from '../resource/ng-ql-resource';

export interface Post {
  id: number;
  title: string;
  status?: string;
  categoryId?: number;
}

@Injectable()
export class PostResource extends NgQlResource<Post> {
  constructor(client: NgQlClient) {
    super(client, { endpoint: 'posts', cacheTags: ['posts'] });
  }
}

export interface Widget {
  id?: number;
  uuid: string;
  name: string;
}

/** A resource whose backend identifies records by `uuid` instead of `id`. */
@Injectable()
export class WidgetResource extends NgQlResource<Widget> {
  constructor(client: NgQlClient) {
    super(client, { endpoint: 'widgets', primaryKey: 'uuid' });
  }
}

/**
 * A resource whose backend expects `PUT /articles/:id/save` for updates and
 * `POST /articles` with `{ id, ...payload }` for patches — exercising
 * `@NgQlEndpoint`'s `url` template and `idIn: 'body'`.
 */
@Injectable()
export class ArticleResource extends NgQlResource<Post> {
  constructor(client: NgQlClient) {
    super(client, { endpoint: 'articles' });
  }

  @NgQlEndpoint({ url: 'articles/:id/save' })
  override update(id: number, payload: Partial<Post>) {
    return super.update(id, payload);
  }

  @NgQlEndpoint({ method: 'POST', idIn: 'body' })
  override patch(id: number, payload: Partial<Post>) {
    return super.patch(id, payload);
  }
}
