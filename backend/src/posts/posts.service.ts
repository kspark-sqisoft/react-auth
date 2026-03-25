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
import { Repository } from 'typeorm';
import { POST_IMAGES_SUBDIR, UPLOAD_ROOT } from '../env.constants';
import { Post } from './post.entity';

export type PostAuthorPublic = { id: number; name: string };

export type PostPublic = {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: PostAuthorPublic;
};

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post)
    private repo: Repository<Post>,
  ) {}

  private imagePublicUrl(filename: string | null): string | null {
    if (!filename) return null;
    return `/uploads/${POST_IMAGES_SUBDIR}/${filename}`;
  }

  private async unlinkPostImage(filename: string | null): Promise<void> {
    if (!filename) return;
    const full = join(UPLOAD_ROOT, POST_IMAGES_SUBDIR, filename);
    if (existsSync(full)) {
      await unlink(full);
    }
  }

  private toPublic(post: Post): PostPublic {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      imageUrl: this.imagePublicUrl(post.imageFilename),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: { id: post.author.id, name: post.author.name },
    };
  }

  async findPage(
    skip: number,
    take: number,
  ): Promise<{ items: PostPublic[]; total: number }> {
    this.logger.log(`[글] 목록 페이지 조회 skip=${skip} take=${take}`);
    const [posts, total] = await this.repo.findAndCount({
      relations: ['author'],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    this.logger.log(
      `[글] 목록 페이지 응답 반환=${posts.length} total=${total}`,
    );
    return {
      items: posts.map((p) => this.toPublic(p)),
      total,
    };
  }

  async findOne(id: number): Promise<PostPublic> {
    this.logger.log(`[글] 단건 조회 postId=${id}`);
    const post = await this.repo.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!post) {
      this.logger.warn(`[글] 단건 없음 postId=${id}`);
      throw new NotFoundException();
    }
    this.logger.log(`[글] 단건 응답 postId=${id} authorId=${post.author.id}`);
    return this.toPublic(post);
  }

  async create(
    authorId: number,
    body: { title: string; content: string; imageFilename?: string | null },
  ): Promise<PostPublic> {
    const title = body.title?.trim();
    if (!title) {
      throw new BadRequestException('제목이 필요합니다.');
    }
    const entity = this.repo.create({
      title,
      content: body.content ?? '',
      imageFilename: body.imageFilename ?? null,
      author: { id: authorId },
    });
    const saved = await this.repo.save(entity);
    const withAuthor = await this.repo.findOneOrFail({
      where: { id: saved.id },
      relations: ['author'],
    });
    this.logger.log(
      `[글] 작성 완료 postId=${saved.id} authorId=${authorId} title=${saved.title.slice(0, 40)}${saved.title.length > 40 ? '…' : ''}`,
    );
    return this.toPublic(withAuthor);
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
    if (body.content !== undefined) post.content = body.content;
    await this.repo.save(post);

    const refreshed = await this.repo.findOneOrFail({
      where: { id },
      relations: ['author'],
    });
    this.logger.log(`[글] 수정 완료 postId=${id}`);
    return this.toPublic(refreshed);
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
}
