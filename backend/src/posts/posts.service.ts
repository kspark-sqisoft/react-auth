import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  AVATARS_SUBDIR,
  POST_IMAGES_SUBDIR,
  UPLOAD_ROOT,
} from '../env.constants';
import { Post } from './post.entity';
import { PostLike } from './post-like.entity';
import {
  postContentPlainLength,
  sanitizePostContentHtml,
} from './post-content-sanitize';

export type PostAuthorPublic = {
  id: number;
  name: string;
  imageUrl: string | null;
};

export type PostPublic = {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: PostAuthorPublic;
  likeCount: number;
  likedByMe: boolean;
};

export type PostLikeState = { likeCount: number; likedByMe: boolean };

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post)
    private repo: Repository<Post>,
    @InjectRepository(PostLike)
    private likeRepo: Repository<PostLike>,
  ) {}

  private imagePublicUrl(filename: string | null): string | null {
    if (!filename) return null;
    return `/uploads/${POST_IMAGES_SUBDIR}/${filename}`;
  }

  private authorAvatarUrl(profileImageFilename: string | null): string | null {
    if (!profileImageFilename) return null;
    return `/uploads/${AVATARS_SUBDIR}/${profileImageFilename}`;
  }

  private async unlinkPostImage(filename: string | null): Promise<void> {
    if (!filename) return;
    const full = join(UPLOAD_ROOT, POST_IMAGES_SUBDIR, filename);
    if (existsSync(full)) {
      await unlink(full);
    }
  }

  private static readonly SEARCH_MAX_LEN = 120;
  private static readonly POST_CONTENT_MAX = 200_000;

  /**
   * SQLite LIKE + ESCAPE는 이스케이프 문자가 정확히 1글자여야 함.
   * 백슬래시 리터럴은 `ESCAPE '\\'`가 드라이버마다 깨지므로 `!`를 사용.
   */
  private escapeLikePattern(raw: string): string {
    return raw.replace(/!/g, '!!').replace(/%/g, '!%').replace(/_/g, '!_');
  }

  private toPublic(post: Post, extras?: PostLikeState): PostPublic {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      imageUrl: this.imagePublicUrl(post.imageFilename),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: {
        id: post.author.id,
        name: post.author.name,
        imageUrl: this.authorAvatarUrl(post.author.profileImageFilename),
      },
      likeCount: extras?.likeCount ?? 0,
      likedByMe: extras?.likedByMe ?? false,
    };
  }

  private async getLikeAggregates(
    postIds: number[],
    viewerId?: number,
  ): Promise<Map<number, PostLikeState>> {
    const map = new Map<number, PostLikeState>();
    for (const id of postIds) {
      map.set(id, { likeCount: 0, likedByMe: false });
    }
    if (postIds.length === 0) return map;

    const countRows = await this.likeRepo
      .createQueryBuilder('l')
      .select('l.postId', 'postId')
      .addSelect('COUNT(*)', 'cnt')
      .where('l.postId IN (:...ids)', { ids: postIds })
      .groupBy('l.postId')
      .getRawMany<{ postId: number; cnt: string }>();

    for (const row of countRows) {
      const pid = Number(row.postId);
      const cur = map.get(pid);
      if (cur) cur.likeCount = Number(row.cnt);
    }

    if (viewerId != null) {
      const likedRows = await this.likeRepo
        .createQueryBuilder('l')
        .select('l.postId', 'postId')
        .where('l.userId = :uid', { uid: viewerId })
        .andWhere('l.postId IN (:...ids)', { ids: postIds })
        .getRawMany<{ postId: number }>();
      for (const row of likedRows) {
        const pid = Number(row.postId);
        const cur = map.get(pid);
        if (cur) cur.likedByMe = true;
      }
    }

    return map;
  }

  async getLikeState(postId: number, userId: number): Promise<PostLikeState> {
    const likeCount = await this.likeRepo.count({
      where: { post: { id: postId } },
    });
    const likedByMe =
      (await this.likeRepo.count({
        where: { user: { id: userId }, post: { id: postId } },
      })) > 0;
    return { likeCount, likedByMe };
  }

  async findPage(
    skip: number,
    take: number,
    viewerId?: number,
    search?: string,
  ): Promise<{ items: PostPublic[]; total: number }> {
    const raw = search?.trim() ?? '';
    const term =
      raw.length > PostsService.SEARCH_MAX_LEN
        ? raw.slice(0, PostsService.SEARCH_MAX_LEN)
        : raw;

    this.logger.log(
      `[글] 목록 페이지 조회 skip=${skip} take=${take} search=${term ? `"${term.slice(0, 40)}${term.length > 40 ? '…' : ''}"` : '(없음)'}`,
    );

    const qb = this.repo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author');

    if (term.length > 0) {
      const pattern = `%${this.escapeLikePattern(term)}%`;
      qb.andWhere(
        "(post.title LIKE :pattern ESCAPE '!' OR post.content LIKE :pattern ESCAPE '!')",
        { pattern },
      );
    }

    qb.orderBy('post.createdAt', 'DESC').skip(skip).take(take);

    const [posts, total] = await qb.getManyAndCount();
    const ids = posts.map((p) => p.id);
    const agg = await this.getLikeAggregates(ids, viewerId);
    this.logger.log(
      `[글] 목록 페이지 응답 반환=${posts.length} total=${total}`,
    );
    return {
      items: posts.map((p) => this.toPublic(p, agg.get(p.id))),
      total,
    };
  }

  async findOne(id: number, viewerId?: number): Promise<PostPublic> {
    this.logger.log(`[글] 단건 조회 postId=${id}`);
    const post = await this.repo.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!post) {
      this.logger.warn(`[글] 단건 없음 postId=${id}`);
      throw new NotFoundException();
    }
    const agg = await this.getLikeAggregates([id], viewerId);
    const meta = agg.get(id)!;
    this.logger.log(`[글] 단건 응답 postId=${id} authorId=${post.author.id}`);
    return this.toPublic(post, meta);
  }

  async create(
    authorId: number,
    body: { title: string; content: string; imageFilename?: string | null },
  ): Promise<PostPublic> {
    const title = body.title?.trim();
    if (!title) {
      throw new BadRequestException('제목이 필요합니다.');
    }
    const rawContent = body.content ?? '';
    if (rawContent.length > PostsService.POST_CONTENT_MAX) {
      throw new BadRequestException('본문이 너무 깁니다.');
    }
    const content = sanitizePostContentHtml(rawContent);
    if (postContentPlainLength(content) === 0) {
      throw new BadRequestException('본문이 비어 있습니다.');
    }
    const entity = this.repo.create({
      title,
      content,
      imageFilename: body.imageFilename ?? null,
      author: { id: authorId },
    });
    const saved = await this.repo.save(entity);
    const withAuthor = await this.repo.findOneOrFail({
      where: { id: saved.id },
      relations: ['author'],
    });
    const likeState = await this.getLikeState(saved.id, authorId);
    this.logger.log(
      `[글] 작성 완료 postId=${saved.id} authorId=${authorId} title=${saved.title.slice(0, 40)}${saved.title.length > 40 ? '…' : ''}`,
    );
    return this.toPublic(withAuthor, likeState);
  }

  async update(
    authorId: number,
    id: number,
    body: {
      title?: string;
      content?: string;
      newImageFilename?: string;
      removeImage?: boolean;
    },
  ): Promise<PostPublic> {
    const post = await this.repo.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!post) {
      this.logger.warn(`[글] 수정 실패: 없음 postId=${id}`);
      throw new NotFoundException();
    }
    if (post.author.id !== authorId) {
      this.logger.warn(
        `[글] 수정 거절: 권한 없음 postId=${id} 요청자=${authorId} 작성자=${post.author.id}`,
      );
      throw new ForbiddenException();
    }

    this.logger.log(`[글] 수정 시도 postId=${id} authorId=${authorId}`);

    if (body.newImageFilename) {
      await this.unlinkPostImage(post.imageFilename);
      post.imageFilename = body.newImageFilename;
    } else if (body.removeImage) {
      await this.unlinkPostImage(post.imageFilename);
      post.imageFilename = null;
    }

    if (body.title !== undefined) {
      const t = body.title.trim();
      if (!t) throw new BadRequestException('제목이 비어 있을 수 없습니다.');
      post.title = t;
    }
    if (body.content !== undefined) {
      const raw = body.content;
      if (raw.length > PostsService.POST_CONTENT_MAX) {
        throw new BadRequestException('본문이 너무 깁니다.');
      }
      const cleaned = sanitizePostContentHtml(raw);
      if (postContentPlainLength(cleaned) === 0) {
        throw new BadRequestException('본문이 비어 있습니다.');
      }
      post.content = cleaned;
    }
    await this.repo.save(post);

    const refreshed = await this.repo.findOneOrFail({
      where: { id },
      relations: ['author'],
    });
    const likeState = await this.getLikeState(id, authorId);
    this.logger.log(`[글] 수정 완료 postId=${id}`);
    return this.toPublic(refreshed, likeState);
  }

  async remove(authorId: number, id: number): Promise<void> {
    const post = await this.repo.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!post) {
      this.logger.warn(`[글] 삭제 실패: 없음 postId=${id}`);
      throw new NotFoundException();
    }
    if (post.author.id !== authorId) {
      this.logger.warn(
        `[글] 삭제 거절: 권한 없음 postId=${id} 요청자=${authorId} 작성자=${post.author.id}`,
      );
      throw new ForbiddenException();
    }
    this.logger.log(`[글] 삭제 완료 postId=${id} authorId=${authorId}`);
    await this.unlinkPostImage(post.imageFilename);
    await this.repo.remove(post);
  }

  /** 이미 좋아요한 경우에도 현재 상태를 반환(멱등). */
  async addLike(userId: number, postId: number): Promise<PostLikeState> {
    const exists = await this.repo.findOne({ where: { id: postId } });
    if (!exists) {
      throw new NotFoundException();
    }
    const already = await this.likeRepo.findOne({
      where: { user: { id: userId }, post: { id: postId } },
    });
    if (!already) {
      try {
        await this.likeRepo.save(
          this.likeRepo.create({
            user: { id: userId },
            post: { id: postId },
          }),
        );
      } catch (e) {
        if (
          e instanceof QueryFailedError &&
          /UNIQUE|unique/i.test(String(e.message))
        ) {
          this.logger.debug(
            `[글] 좋아요 유니크 경합 무시 postId=${postId} userId=${userId}`,
          );
        } else {
          throw e;
        }
      }
    }
    return this.getLikeState(postId, userId);
  }

  /** 좋아요 없어도 현재 상태 반환(멱등). */
  async removeLike(userId: number, postId: number): Promise<PostLikeState> {
    const exists = await this.repo.findOne({ where: { id: postId } });
    if (!exists) {
      throw new NotFoundException();
    }
    await this.likeRepo.delete({
      user: { id: userId },
      post: { id: postId },
    });
    return this.getLikeState(postId, userId);
  }
}
