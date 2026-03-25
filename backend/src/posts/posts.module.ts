import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Post } from './post.entity';
import { PostLike } from './post-like.entity';
import { PostComment } from './post-comment.entity';
import { CommentsService } from './comments.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post, PostLike, PostComment]), AuthModule],
  controllers: [PostsController],
  providers: [PostsService, CommentsService],
})
export class PostsModule {}
