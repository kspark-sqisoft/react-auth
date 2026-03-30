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
  POST_VIDEO_POSTERS_SUBDIR,
  POST_VIDEOS_SUBDIR,
  UPLOAD_ROOT,
} from '../env.constants';
import { PostAttachment } from './post-attachment.entity';
import { POST_ATTACHMENTS_MAX_COUNT } from './post-attachments-multer.options';
import { Post } from './post.entity';
import { PostLike } from './post-like.entity';
import {
  POST_MEDIA_IMAGE_MAX_BYTES,
  POST_MEDIA_POSTER_MAX_BYTES,
} from './post-media-upload.options';
import {
  postContentPlainLength,
  sanitizePostContentHtml,
} from './post-content-sanitize';

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export type PostAuthorPublic = {
  id: number;
  name: string;
  imageUrl: string | null;
};

export type PostMediaItemPublic = {
  id: number;
  kind: 'image' | 'video';
  url: string;
  posterUrl: string | null;
};

export type PostPublic = {
  id: number;
  title: string;
  content: string;
  /** 순서대로 첨부(이미지·동영상) */
  media: PostMediaItemPublic[];
  /** 목록 썸네일(첫 첨부 기준) */
  coverThumbUrl: string | null;
  coverKind: 'image' | 'video' | null;
  /** 첫 첨부가 이미지일 때만 (호환) */
  imageUrl: string | null;
  /** 첫 첨부가 동영상일 때만 (호환) */
  videoUrl: string | null;
  videoPosterUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: PostAuthorPublic;
  likeCount: number;
  likedByMe: boolean;
};

export type PostLikeState = { likeCount: number; likedByMe: boolean };

type MediaPlanItem = { t: 'e'; id: number } | { t: 'n'; i: number };

@Injectable()
export class PostsService {
  private readonly logger = new Logger('PostsService');

  constructor(
    @InjectRepository(Post)
    private repo: Repository<Post>,
    @InjectRepository(PostAttachment)
    private attRepo: Repository<PostAttachment>,
    @InjectRepository(PostLike)
    private likeRepo: Repository<PostLike>,
  ) {}

  private static multerKind(
    file: Express.Multer.File,
  ): 'image' | 'video' | null {
    if (IMAGE_MIME.has(file.mimetype)) return 'image';
    if (VIDEO_MIME.has(file.mimetype)) return 'video';
    return null;
  }

  private imagePublicUrl(filename: string | null): string | null {
    if (!filename) return null;
    return `/uploads/${POST_IMAGES_SUBDIR}/${filename}`;
  }

  private videoPublicUrl(filename: string | null): string | null {
    if (!filename) return null;
    return `/uploads/${POST_VIDEOS_SUBDIR}/${filename}`;
  }

  private videoPosterPublicUrl(filename: string | null): string | null {
    if (!filename) return null;
    return `/uploads/${POST_VIDEO_POSTERS_SUBDIR}/${filename}`;
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

  private async unlinkPostVideo(filename: string | null): Promise<void> {
    if (!filename) return;
    const full = join(UPLOAD_ROOT, POST_VIDEOS_SUBDIR, filename);
    if (existsSync(full)) {
      await unlink(full);
    }
  }

  private async unlinkPostVideoPoster(filename: string | null): Promise<void> {
    if (!filename) return;
    const full = join(UPLOAD_ROOT, POST_VIDEO_POSTERS_SUBDIR, filename);
    if (existsSync(full)) {
      await unlink(full);
    }
  }

  private async unlinkAttachmentRow(a: PostAttachment): Promise<void> {
    if (a.kind === 'image') {
      await this.unlinkPostImage(a.fileFilename);
    } else {
      await this.unlinkPostVideo(a.fileFilename);
      await this.unlinkPostVideoPoster(a.posterFilename);
    }
  }

  private async deleteAllAttachments(postId: number): Promise<void> {
    const rows = await this.attRepo.find({
      where: { post: { id: postId } },
    });
    for (const a of rows) {
      await this.unlinkAttachmentRow(a);
    }
    await this.attRepo.delete({ post: { id: postId } });
  }

  private sortedAttachments(post: Post): PostAttachment[] {
    const list = post.attachments ?? [];
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private attachmentToPublic(a: PostAttachment): PostMediaItemPublic {
    const url =
      a.kind === 'image'
        ? this.imagePublicUrl(a.fileFilename)!
        : this.videoPublicUrl(a.fileFilename)!;
    const posterUrl =
      a.kind === 'video' ? this.videoPosterPublicUrl(a.posterFilename) : null;
    return { id: a.id, kind: a.kind, url, posterUrl };
  }

  private toPublic(post: Post, extras?: PostLikeState): PostPublic {
    const media = this.sortedAttachments(post).map((a) =>
      this.attachmentToPublic(a),
    );
    const first = media[0];
    const coverThumbUrl = first
      ? first.kind === 'image'
        ? first.url
        : (first.posterUrl ?? null)
      : null;
    const coverKind = first?.kind ?? null;

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      media,
      coverThumbUrl,
      coverKind,
      imageUrl: first?.kind === 'image' ? first.url : null,
      videoUrl: first?.kind === 'video' ? first.url : null,
      videoPosterUrl: first?.kind === 'video' ? first.posterUrl : null,
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

  private static readonly SEARCH_MAX_LEN = 120;
  private static readonly POST_CONTENT_MAX = 200_000;

  private escapeLikePattern(raw: string): string {
    return raw.replace(/!/g, '!!').replace(/%/g, '!%').replace(/_/g, '!_');
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
      `[POSTS-10-SVC] 목록 페이지 조회 skip=${skip} take=${take} search=${term ? `"${term.slice(0, 40)}${term.length > 40 ? '…' : ''}"` : '(없음)'}`,
    );

    const applySearch = (
      qb: ReturnType<Repository<Post>['createQueryBuilder']>,
    ) => {
      if (term.length > 0) {
        const pattern = `%${this.escapeLikePattern(term)}%`;
        qb.andWhere(
          "(post.title LIKE :pattern ESCAPE '!' OR post.content LIKE :pattern ESCAPE '!')",
          { pattern },
        );
      }
    };

    /** 첨부 JOIN과 함께 take/skip 하면 행 단위로 잘려 글 개수가 부족해지므로, 글 id만 페이지네이션 후 관계 로드 */
    const idQb = this.repo
      .createQueryBuilder('post')
      .select('post.id')
      .orderBy('post.createdAt', 'DESC');
    applySearch(idQb);
    idQb.skip(skip).take(take);
    const idRows = await idQb.getMany();
    const ids = idRows.map((p) => p.id);

    const countQb = this.repo.createQueryBuilder('post');
    applySearch(countQb);
    const total = await countQb.getCount();

    if (ids.length === 0) {
      this.logger.log(`[POSTS-10-SVC] 목록 페이지 응답 반환=0 total=${total}`);
      return { items: [], total };
    }

    const postsRaw = await this.repo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.attachments', 'att')
      .where('post.id IN (:...ids)', { ids })
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('att.sortOrder', 'ASC')
      .getMany();
    const byId = new Map(postsRaw.map((p) => [p.id, p]));
    const posts = ids.map((id) => byId.get(id)!);
    const agg = await this.getLikeAggregates(ids, viewerId);
    this.logger.log(
      `[POSTS-10-SVC] 목록 페이지 응답 반환=${posts.length} total=${total}`,
    );
    return {
      items: posts.map((p) => this.toPublic(p, agg.get(p.id))),
      total,
    };
  }

  async findOne(id: number, viewerId?: number): Promise<PostPublic> {
    this.logger.log(`[POSTS-10-SVC] 단건 조회 postId=${id}`);
    const post = await this.repo.findOne({
      where: { id },
      relations: ['author', 'attachments'],
    });
    if (!post) {
      this.logger.warn(`[POSTS-10-SVC] 단건 없음 postId=${id}`);
      throw new NotFoundException();
    }
    const agg = await this.getLikeAggregates([id], viewerId);
    const meta = agg.get(id)!;
    this.logger.log(
      `[POSTS-10-SVC] 단건 응답 postId=${id} authorId=${post.author.id}`,
    );
    return this.toPublic(post, meta);
  }

  private validateAttachmentFileSizes(files: Express.Multer.File[]): void {
    for (const f of files) {
      const k = PostsService.multerKind(f);
      if (!k) {
        throw new BadRequestException('지원하지 않는 첨부 형식입니다.');
      }
      if (k === 'image' && f.size > POST_MEDIA_IMAGE_MAX_BYTES) {
        throw new BadRequestException(
          '이미지 첨부는 파일당 5MB 이하여야 합니다.',
        );
      }
    }
  }

  async createWithAttachments(
    authorId: number,
    titleRaw: string,
    contentRaw: string,
    attachmentFiles: Express.Multer.File[],
    posterFiles: Express.Multer.File[],
  ): Promise<PostPublic> {
    const title = titleRaw?.trim();
    if (!title) {
      throw new BadRequestException('제목이 필요합니다.');
    }
    if (attachmentFiles.length > POST_ATTACHMENTS_MAX_COUNT) {
      throw new BadRequestException(
        `첨부는 최대 ${POST_ATTACHMENTS_MAX_COUNT}개까지 가능합니다.`,
      );
    }
    const rawContent = contentRaw ?? '';
    if (rawContent.length > PostsService.POST_CONTENT_MAX) {
      throw new BadRequestException('본문이 너무 깁니다.');
    }
    const content = sanitizePostContentHtml(rawContent);
    if (postContentPlainLength(content) === 0) {
      throw new BadRequestException('본문이 비어 있습니다.');
    }

    this.validateAttachmentFileSizes(attachmentFiles);
    for (const p of posterFiles) {
      if (p.size > POST_MEDIA_POSTER_MAX_BYTES) {
        throw new BadRequestException(
          '동영상 썸네일은 파일당 2MB 이하여야 합니다.',
        );
      }
    }

    const videoCount = attachmentFiles.filter(
      (f) => PostsService.multerKind(f) === 'video',
    ).length;
    if (posterFiles.length !== videoCount) {
      throw new BadRequestException(
        `첨부 동영상이 ${videoCount}개이면 posters도 ${videoCount}개를 보내 주세요. (썸네일이 없으면 1×1 JPEG 등 작은 이미지로 채울 수 있습니다.)`,
      );
    }

    const saved = await this.repo.save(
      this.repo.create({
        title,
        content,
        author: { id: authorId },
      }),
    );

    let posterIdx = 0;
    for (let i = 0; i < attachmentFiles.length; i++) {
      const f = attachmentFiles[i];
      const kind = PostsService.multerKind(f)!;
      let posterFilename: string | null = null;
      if (kind === 'video') {
        posterFilename = posterFiles[posterIdx++].filename;
      }
      await this.attRepo.save(
        this.attRepo.create({
          postId: saved.id,
          sortOrder: i,
          kind,
          fileFilename: f.filename,
          posterFilename,
        }),
      );
    }

    const withAll = await this.repo.findOneOrFail({
      where: { id: saved.id },
      relations: ['author', 'attachments'],
    });
    const likeState = await this.getLikeState(saved.id, authorId);
    this.logger.log(
      `[POSTS-10-SVC] 작성 완료 postId=${saved.id} authorId=${authorId} 첨부=${attachmentFiles.length}`,
    );
    return this.toPublic(withAll, likeState);
  }

  async updatePost(
    authorId: number,
    id: number,
    body: {
      title?: string;
      content?: string;
      clearAllMedia?: boolean;
      mediaPlan?: MediaPlanItem[];
      newFiles?: Express.Multer.File[];
      newPosters?: Express.Multer.File[];
    },
  ): Promise<PostPublic> {
    const post = await this.repo.findOne({
      where: { id },
      relations: ['author', 'attachments'],
    });
    if (!post) {
      this.logger.warn(`[POSTS-10-SVC] 수정 실패: 없음 postId=${id}`);
      throw new NotFoundException();
    }
    if (post.author.id !== authorId) {
      this.logger.warn(
        `[POSTS-10-SVC] 수정 거절: 권한 없음 postId=${id} 요청자=${authorId} 작성자=${post.author.id}`,
      );
      throw new ForbiddenException();
    }

    this.logger.log(
      `[POSTS-10-SVC] 수정 시도 postId=${id} authorId=${authorId}`,
    );

    const newFiles = body.newFiles ?? [];
    const newPosters = body.newPosters ?? [];
    this.validateAttachmentFileSizes(newFiles);
    for (const p of newPosters) {
      if (p.size > POST_MEDIA_POSTER_MAX_BYTES) {
        throw new BadRequestException(
          '동영상 썸네일은 파일당 2MB 이하여야 합니다.',
        );
      }
    }

    if (body.clearAllMedia) {
      await this.deleteAllAttachments(id);
    } else if (body.mediaPlan !== undefined) {
      const items = body.mediaPlan;
      if (items.length > POST_ATTACHMENTS_MAX_COUNT) {
        throw new BadRequestException(
          `첨부는 최대 ${POST_ATTACHMENTS_MAX_COUNT}개까지 가능합니다.`,
        );
      }

      if (items.length === 0) {
        await this.deleteAllAttachments(id);
      } else {
        const current = this.sortedAttachments(post);
        const keptIds = new Set<number>();
        for (const it of items) {
          if (it.t === 'e') keptIds.add(it.id);
        }

        for (const a of current) {
          if (!keptIds.has(a.id)) {
            await this.unlinkAttachmentRow(a);
            await this.attRepo.delete({ id: a.id });
          }
        }

        const remaining = await this.attRepo.find({
          where: { post: { id: post.id } },
          order: { sortOrder: 'ASC' },
        });
        const byId = new Map(remaining.map((a) => [a.id, a]));

        const newVideoCount = items
          .filter((it): it is { t: 'n'; i: number } => it.t === 'n')
          .map((it) => newFiles[it.i])
          .filter((f) => f && PostsService.multerKind(f) === 'video').length;
        if (newPosters.length !== newVideoCount) {
          throw new BadRequestException(
            `새 동영상이 ${newVideoCount}개이면 newPosters도 ${newVideoCount}개가 필요합니다.`,
          );
        }

        let posterIdx = 0;
        let order = 0;
        for (const it of items) {
          if (it.t === 'e') {
            const row = byId.get(it.id);
            if (!row || row.postId !== post.id) {
              throw new BadRequestException('잘못된 첨부 id입니다.');
            }
            row.sortOrder = order++;
            await this.attRepo.save(row);
          } else {
            const f = newFiles[it.i];
            if (!f) {
              throw new BadRequestException('새 첨부 파일이 부족합니다.');
            }
            const kind = PostsService.multerKind(f);
            if (!kind) {
              throw new BadRequestException(
                '지원하지 않는 새 첨부 형식입니다.',
              );
            }
            let posterFilename: string | null = null;
            if (kind === 'video') {
              posterFilename = newPosters[posterIdx++].filename;
            }
            await this.attRepo.save(
              this.attRepo.create({
                postId: post.id,
                sortOrder: order++,
                kind,
                fileFilename: f.filename,
                posterFilename,
              }),
            );
          }
        }
      }
    }

    /** 첨부는 attRepo로만 다룸. post.attachments는 로드 시점 스냅샷이라 save(post) cascade 시 postId가 깨질 수 있음 */
    const titleContentPatch: Partial<Pick<Post, 'title' | 'content'>> = {};
    if (body.title !== undefined) {
      const t = body.title.trim();
      if (!t) throw new BadRequestException('제목이 비어 있을 수 없습니다.');
      post.title = t;
      titleContentPatch.title = t;
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
      titleContentPatch.content = cleaned;
    }
    if (Object.keys(titleContentPatch).length > 0) {
      await this.repo.update({ id: post.id }, titleContentPatch);
    }

    const refreshed = await this.repo.findOneOrFail({
      where: { id },
      relations: ['author', 'attachments'],
    });
    const likeState = await this.getLikeState(id, authorId);
    this.logger.log(`[POSTS-10-SVC] 수정 완료 postId=${id}`);
    return this.toPublic(refreshed, likeState);
  }

  async remove(authorId: number, id: number): Promise<void> {
    const post = await this.repo.findOne({
      where: { id },
      relations: ['author', 'attachments'],
    });
    if (!post) {
      this.logger.warn(`[POSTS-10-SVC] 삭제 실패: 없음 postId=${id}`);
      throw new NotFoundException();
    }
    if (post.author.id !== authorId) {
      this.logger.warn(
        `[POSTS-10-SVC] 삭제 거절: 권한 없음 postId=${id} 요청자=${authorId} 작성자=${post.author.id}`,
      );
      throw new ForbiddenException();
    }
    this.logger.log(
      `[POSTS-10-SVC] 삭제 완료 postId=${id} authorId=${authorId}`,
    );
    for (const a of this.sortedAttachments(post)) {
      await this.unlinkAttachmentRow(a);
    }
    await this.repo.remove(post);
  }

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
            `[POSTS-10-SVC] 좋아요 유니크 경합 무시 postId=${postId} userId=${userId}`,
          );
        } else {
          throw e;
        }
      }
    }
    return this.getLikeState(postId, userId);
  }

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
