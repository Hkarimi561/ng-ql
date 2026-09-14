import { Injectable } from '@angular/core';
import { NgQlClient } from '../client/ng-ql-client';
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
