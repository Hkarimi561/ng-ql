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
