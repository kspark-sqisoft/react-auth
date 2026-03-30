import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AVATARS_SUBDIR } from '../env.constants';
import { Post } from './post.entity';
import { PostComment } from './post-comment.entity';

export type CommentAuthorPublic = {
  id: number;
  name: string;
  imageUrl: string | null;
};

export type CommentPublic = {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: CommentAuthorPublic;
  replies: CommentPublic[];
};

@Injectable()
export class CommentsService {
  private readonly logger = new Logger('CommentsService');
  private static readonly CONTENT_MAX = 8000;

  constructor(
    @InjectRepository(PostComment)
    private commentRepo: Repository<PostComment>,
    @InjectRepository(Post)
    private postRepo: Repository<Post>,
  ) {}

  private authorAvatarUrl(profileImageFilename: string | null): string | null {
    if (!profileImageFilename) return null;
    return `/uploads/${AVATARS_SUBDIR}/${profileImageFilename}`;
  }

  private toPublic(c: PostComment, replies: CommentPublic[]): CommentPublic {
    return {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      author: {
        id: c.author.id,
        name: c.author.name,
        imageUrl: this.authorAvatarUrl(c.author.profileImageFilename),
      },
      replies,
    };
  }

  private sortTree(nodes: CommentPublic[]): void {
    nodes.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    for (const n of nodes) this.sortTree(n.replies);
  }

  private buildTree(rows: PostComment[]): CommentPublic[] {
    const byId = new Map<number, CommentPublic>();
    for (const row of rows) {
      byId.set(row.id, this.toPublic(row, []));
    }
    const roots: CommentPublic[] = [];
    for (const row of rows) {
      const node = byId.get(row.id)!;
      const pid = row.parent?.id;
      if (pid == null) {
        roots.push(node);
      } else {
        const parent = byId.get(pid);
        if (parent) parent.replies.push(node);
        else roots.push(node);
      }
    }
    this.sortTree(roots);
    return roots;
  }

  async findTreeByPostId(postId: number): Promise<CommentPublic[]> {
    const exists = await this.postRepo.exist({ where: { id: postId } });
    if (!exists) {
      throw new NotFoundException();
    }
    const rows = await this.commentRepo.find({
      where: { post: { id: postId } },
      relations: ['author', 'parent'],
      order: { createdAt: 'ASC' },
    });
    return this.buildTree(rows);
  }

  async create(
    postId: number,
    authorId: number,
    body: { content: string; parentId?: number },
  ): Promise<CommentPublic> {
    this.logger.log(
      `[POSTS-11-CMT] create | postId=${postId} authorId=${authorId}`,
    );
    const postExists = await this.postRepo.exist({ where: { id: postId } });
    if (!postExists) {
      throw new NotFoundException();
    }

    const raw = body.content?.trim() ?? '';
    if (!raw) {
      throw new BadRequestException('댓글 내용이 필요합니다.');
    }
    if (raw.length > CommentsService.CONTENT_MAX) {
      throw new BadRequestException(
        `댓글은 ${CommentsService.CONTENT_MAX}자 이하로 작성해 주세요.`,
      );
    }

    let parent: PostComment | null = null;
    if (body.parentId != null) {
      parent = await this.commentRepo.findOne({
        where: { id: body.parentId, post: { id: postId } },
        relations: ['author'],
      });
      if (!parent) {
        throw new BadRequestException(
          '대댓글 대상이 없거나 이 글에 속하지 않습니다.',
        );
      }
    }

    const entity = this.commentRepo.create({
      content: raw,
      post: { id: postId },
      author: { id: authorId },
      parent: parent ? { id: parent.id } : null,
    });
    const saved = await this.commentRepo.save(entity);
    const withAuthor = await this.commentRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['author'],
    });
    this.logger.log(
      `[POSTS-11-CMT] create 완료 | postId=${postId} commentId=${saved.id} parentId=${body.parentId ?? '—'}`,
    );
    return this.toPublic(withAuthor, []);
  }

  async remove(
    postId: number,
    commentId: number,
    userId: number,
  ): Promise<void> {
    this.logger.log(
      `[POSTS-11-CMT] remove | postId=${postId} commentId=${commentId} userId=${userId}`,
    );
    const c = await this.commentRepo.findOne({
      where: { id: commentId, post: { id: postId } },
      relations: ['author'],
    });
    if (!c) {
      throw new NotFoundException();
    }
    if (c.author.id !== userId) {
      throw new ForbiddenException();
    }
    await this.commentRepo.remove(c);
    this.logger.log(
      `[POSTS-11-CMT] remove 완료 | postId=${postId} commentId=${commentId}`,
    );
  }
}
