import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Post } from './post.entity';
import { PostAttachment } from './post-attachment.entity';
import { PostLike } from './post-like.entity';
import { PostComment } from './post-comment.entity';
import { CommentsService } from './comments.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import {
  PostsDomainSpanInterceptor,
  PostsDomainSpanMiddleware,
} from './posts-domain-span';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, PostAttachment, PostLike, PostComment]),
    AuthModule,
  ],
  controllers: [PostsController],
  providers: [
    PostsService,
    CommentsService,
    PostsDomainSpanMiddleware,
    PostsDomainSpanInterceptor,
  ],
})
export class PostsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PostsDomainSpanMiddleware).forRoutes(PostsController);
  }
}
