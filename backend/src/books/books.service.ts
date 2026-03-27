import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AVATARS_SUBDIR,
  BOOK_IMAGES_SUBDIR,
  BOOK_VIDEO_POSTERS_SUBDIR,
  BOOK_VIDEOS_SUBDIR,
} from '../env.constants';
import { BookPage } from './book-page.entity';
import { Book } from './book.entity';

const TITLE_MAX = 200;
const MAX_PAGES = 80;
const MAX_ELEMENTS_PER_PAGE = 120;
const DEFAULT_PAGE_W = 960;
const DEFAULT_PAGE_H = 540;
const PAGE_NAME_MAX = 120;

export type BookAuthorPublic = {
  id: number;
  name: string;
  imageUrl: string | null;
};

export type BookCanvasElementPublic =
  | {
      id: string;
      type: 'text';
      x: number;
      y: number;
      text: string;
      richHtml?: string;
      fontSize: number;
      fill: string;
      width?: number;
      height?: number;
      /** 0~1, 생략 시 1 */
      opacity?: number;
      /** 시계 방향 도(°), 생략 시 0 */
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
    }
  | {
      id: string;
      type: 'image';
      x: number;
      y: number;
      width: number;
      height: number;
      src: string;
      objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
    }
  | {
      id: string;
      type: 'video';
      x: number;
      y: number;
      width: number;
      height: number;
      src: string;
      posterSrc: string | null;
      objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
    }
  | {
      id: string;
      type: 'weather';
      x: number;
      y: number;
      width: number;
      height: number;
      cityQuery?: string;
      weatherDisplay?: Record<string, boolean>;
      weatherBackground?: string;
      weatherTextColor?: string;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
    }
  | {
      id: string;
      type: 'digitalClock';
      x: number;
      y: number;
      width: number;
      height: number;
      clockDisplay?: Record<string, boolean>;
      /** CSS 배경색(rgba 등). */
      clockBackground?: string;
      clockTextColor?: string;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
    };

export type BookPagePublic = {
  id: number;
  sortOrder: number;
  /** 표시용 이름; 빈 문자열이면 UI에서 "슬라이드 n" */
  name: string;
  /** 슬라이드 배경(CSS 색) */
  backgroundColor: string;
  elements: BookCanvasElementPublic[];
};

/** 목록 카드 배경용 첫 슬라이드 미리보기 */
export type BookListCoverPreviewPublic = {
  slideWidth: number;
  slideHeight: number;
  backgroundColor: string;
  elements: BookCanvasElementPublic[];
};

export type BookListItemPublic = {
  id: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  author: BookAuthorPublic;
  pageCount: number;
  /** 첫 페이지(정렬 기준) — 없으면 null */
  coverPreview: BookListCoverPreviewPublic | null;
};

export type BookPublic = {
  id: number;
  title: string;
  /** 모든 슬라이드 공통 캔버스 크기 */
  slideWidth: number;
  slideHeight: number;
  createdAt: Date;
  updatedAt: Date;
  author: BookAuthorPublic;
  pages: BookPagePublic[];
};

export type BookPageInput = {
  sortOrder: number;
  name?: string;
  /** 슬라이드 배경(CSS 색); 생략 시 #ffffff */
  backgroundColor?: string;
  elements?: unknown[];
};

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private bookRepo: Repository<Book>,
    @InjectRepository(BookPage)
    private pageRepo: Repository<BookPage>,
  ) {}

  private authorAvatarUrl(profileImageFilename: string | null): string | null {
    if (!profileImageFilename) return null;
    return `/uploads/${AVATARS_SUBDIR}/${profileImageFilename}`;
  }

  private imagePublicUrl(filename: string): string {
    return `/uploads/${BOOK_IMAGES_SUBDIR}/${filename}`;
  }

  private videoPublicUrl(filename: string): string {
    return `/uploads/${BOOK_VIDEOS_SUBDIR}/${filename}`;
  }

  private posterPublicUrl(filename: string): string {
    return `/uploads/${BOOK_VIDEO_POSTERS_SUBDIR}/${filename}`;
  }

  private mapAuthor(u: {
    id: number;
    name: string;
    profileImageFilename: string | null;
  }): BookAuthorPublic {
    return {
      id: u.id,
      name: u.name,
      imageUrl: this.authorAvatarUrl(u.profileImageFilename),
    };
  }

  /** 저장·응답은 `/uploads/...` 경로만 쓰도록 맞춤(절대 URL·쿼리 제거). */
  private normalizeBookMediaUploadsPath(raw: unknown, maxLen = 500): string | null {
    if (typeof raw !== 'string') return null;
    const t = raw.trim();
    if (!t) return null;
    const noQuery = t.includes('?') ? t.slice(0, t.indexOf('?')) : t;
    const idx = noQuery.indexOf('/uploads/');
    if (idx >= 0) {
      const path = noQuery.slice(idx);
      return path.length > maxLen ? path.slice(0, maxLen) : path;
    }
    try {
      const p = new URL(noQuery).pathname;
      if (p.startsWith('/uploads/')) {
        return p.length > maxLen ? p.slice(0, maxLen) : p;
      }
    } catch {
      return null;
    }
    return null;
  }

  private parseElementsJson(raw: string): BookCanvasElementPublic[] {
    try {
      const v = JSON.parse(raw) as unknown;
      if (!Array.isArray(v)) {
        throw new BadRequestException('elements는 배열이어야 합니다.');
      }
      this.validateElements(v);
      return v as BookCanvasElementPublic[];
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('elements JSON이 올바르지 않습니다.');
    }
  }

  private validateElements(arr: unknown[]): void {
    if (arr.length > MAX_ELEMENTS_PER_PAGE) {
      throw new BadRequestException(
        `페이지당 요소는 최대 ${MAX_ELEMENTS_PER_PAGE}개입니다.`,
      );
    }
    for (const el of arr) {
      if (!el || typeof el !== 'object') {
        throw new BadRequestException('요소 형식이 올바르지 않습니다.');
      }
      const o = el as Record<string, unknown>;
      if (typeof o.id !== 'string' || o.id.length > 80) {
        throw new BadRequestException('요소 id가 올바르지 않습니다.');
      }
      if (
        o.type !== 'text' &&
        o.type !== 'image' &&
        o.type !== 'video' &&
        o.type !== 'weather' &&
        o.type !== 'digitalClock'
      ) {
        throw new BadRequestException('지원하지 않는 요소 타입입니다.');
      }
      const x = o.x;
      const y = o.y;
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        throw new BadRequestException('요소 위치(x,y)가 올바르지 않습니다.');
      }
      if (o.type === 'text') {
        if (typeof o.text !== 'string' || o.text.length > 8000) {
          throw new BadRequestException('텍스트 내용이 올바르지 않습니다.');
        }
        if (o.richHtml != null && typeof o.richHtml !== 'string') {
          throw new BadRequestException(
            '텍스트 richHtml 형식이 올바르지 않습니다.',
          );
        }
        if (typeof o.richHtml === 'string' && o.richHtml.length > 32000) {
          throw new BadRequestException('리치 텍스트가 너무 깁니다.');
        }
        const fs = o.fontSize;
        if (typeof fs !== 'number' || fs < 8 || fs > 200) {
          throw new BadRequestException('fontSize가 올바르지 않습니다.');
        }
        if (typeof o.fill !== 'string' || o.fill.length > 40) {
          throw new BadRequestException('fill 색상이 올바르지 않습니다.');
        }
        if (o.width != null) {
          if (typeof o.width !== 'number' || o.width < 20 || o.width > 4000) {
            throw new BadRequestException('텍스트 width가 올바르지 않습니다.');
          }
        }
        if (o.height != null) {
          if (
            typeof o.height !== 'number' ||
            o.height < 28 ||
            o.height > 4000
          ) {
            throw new BadRequestException('텍스트 height가 올바르지 않습니다.');
          }
        }
      } else if (o.type === 'weather') {
        const w = o.width;
        const h = o.height;
        if (
          typeof w !== 'number' ||
          typeof h !== 'number' ||
          w < 24 ||
          h < 24 ||
          w > 4000 ||
          h > 4000
        ) {
          throw new BadRequestException('날씨 위젯 크기가 올바르지 않습니다.');
        }
        if (o.cityQuery != null) {
          if (typeof o.cityQuery !== 'string' || o.cityQuery.length > 120) {
            throw new BadRequestException(
              '날씨 도시 검색어가 올바르지 않습니다.',
            );
          }
        }
        if (o.weatherDisplay != null) {
          if (
            typeof o.weatherDisplay !== 'object' ||
            Array.isArray(o.weatherDisplay)
          ) {
            throw new BadRequestException(
              'weatherDisplay 형식이 올바르지 않습니다.',
            );
          }
          const allowed = new Set([
            'temp',
            'feelsLike',
            'description',
            'icon',
            'humidity',
            'wind',
            'pm25',
            'pm10',
            'aqi',
            'clock',
            'date',
          ]);
          for (const [k, v] of Object.entries(
            o.weatherDisplay as Record<string, unknown>,
          )) {
            if (!allowed.has(k)) {
              throw new BadRequestException(
                'weatherDisplay에 허용되지 않는 키입니다.',
              );
            }
            if (typeof v !== 'boolean') {
              throw new BadRequestException(
                'weatherDisplay 값은 true/false만 가능합니다.',
              );
            }
          }
        }
        if (o.weatherBackground != null) {
          if (
            typeof o.weatherBackground !== 'string' ||
            o.weatherBackground.length > 80
          ) {
            throw new BadRequestException(
              '날씨 카드 배경색이 올바르지 않습니다.',
            );
          }
          if (
            /[<>]/.test(o.weatherBackground) ||
            /url\s*\(/i.test(o.weatherBackground)
          ) {
            throw new BadRequestException(
              '날씨 카드 배경색에 허용되지 않는 문자가 있습니다.',
            );
          }
        }
      } else if (o.type === 'digitalClock') {
        const w = o.width;
        const h = o.height;
        if (
          typeof w !== 'number' ||
          typeof h !== 'number' ||
          w < 24 ||
          h < 24 ||
          w > 4000 ||
          h > 4000
        ) {
          throw new BadRequestException(
            '디지털 시계 위젯 크기가 올바르지 않습니다.',
          );
        }
        if (o.clockDisplay != null) {
          if (
            typeof o.clockDisplay !== 'object' ||
            Array.isArray(o.clockDisplay)
          ) {
            throw new BadRequestException(
              'clockDisplay 형식이 올바르지 않습니다.',
            );
          }
          const allowed = new Set(['seconds', 'date', 'hour12']);
          for (const [k, v] of Object.entries(
            o.clockDisplay as Record<string, unknown>,
          )) {
            if (!allowed.has(k)) {
              throw new BadRequestException(
                'clockDisplay에 허용되지 않는 키입니다.',
              );
            }
            if (typeof v !== 'boolean') {
              throw new BadRequestException(
                'clockDisplay 값은 true/false만 가능합니다.',
              );
            }
          }
        }
        if (o.clockBackground != null) {
          if (
            typeof o.clockBackground !== 'string' ||
            o.clockBackground.length > 80
          ) {
            throw new BadRequestException(
              '디지털 시계 배경색이 올바르지 않습니다.',
            );
          }
          if (
            /[<>]/.test(o.clockBackground) ||
            /url\s*\(/i.test(o.clockBackground)
          ) {
            throw new BadRequestException(
              '디지털 시계 배경색에 허용되지 않는 문자가 있습니다.',
            );
          }
        }
        if (o.clockTextColor != null) {
          if (
            typeof o.clockTextColor !== 'string' ||
            o.clockTextColor.length > 80
          ) {
            throw new BadRequestException(
              '디지털 시계 글자색이 올바르지 않습니다.',
            );
          }
          if (
            /[<>]/.test(o.clockTextColor) ||
            /url\s*\(/i.test(o.clockTextColor)
          ) {
            throw new BadRequestException(
              '디지털 시계 글자색에 허용되지 않는 문자가 있습니다.',
            );
          }
        }
      } else {
        const w = o.width;
        const h = o.height;
        if (
          typeof w !== 'number' ||
          typeof h !== 'number' ||
          w < 10 ||
          h < 10 ||
          w > 4000 ||
          h > 4000
        ) {
          throw new BadRequestException(
            '이미지·비디오 크기가 올바르지 않습니다.',
          );
        }
        const normSrc = this.normalizeBookMediaUploadsPath(o.src);
        if (normSrc == null) {
          throw new BadRequestException('미디어 src가 올바르지 않습니다.');
        }
        o.src = normSrc;
        if (o.type === 'video') {
          const ps = o.posterSrc;
          if (ps != null && ps !== '') {
            const normPs = this.normalizeBookMediaUploadsPath(ps);
            if (normPs == null) {
              throw new BadRequestException('posterSrc가 올바르지 않습니다.');
            }
            o.posterSrc = normPs;
          }
        }
        if (o.objectFit != null) {
          const allowed = new Set([
            'cover',
            'contain',
            'fill',
            'none',
            'scale-down',
          ]);
          if (typeof o.objectFit !== 'string' || !allowed.has(o.objectFit)) {
            throw new BadRequestException('objectFit 값이 올바르지 않습니다.');
          }
        }
      }
      if (o.borderRadius != null) {
        if (
          typeof o.borderRadius !== 'number' ||
          !Number.isFinite(o.borderRadius) ||
          o.borderRadius < 0 ||
          o.borderRadius > 2000
        ) {
          throw new BadRequestException(
            '요소 borderRadius가 올바르지 않습니다.',
          );
        }
      }
      if (o.outlineWidth != null) {
        if (
          typeof o.outlineWidth !== 'number' ||
          !Number.isFinite(o.outlineWidth) ||
          o.outlineWidth < 0 ||
          o.outlineWidth > 32
        ) {
          throw new BadRequestException(
            '요소 outlineWidth가 올바르지 않습니다.',
          );
        }
      }
      if (o.outlineColor != null) {
        if (
          typeof o.outlineColor !== 'string' ||
          o.outlineColor.length > 80 ||
          /[<>]/.test(o.outlineColor) ||
          /url\s*\(/i.test(o.outlineColor)
        ) {
          throw new BadRequestException(
            '요소 outlineColor가 올바르지 않습니다.',
          );
        }
      }
      if (o.opacity != null) {
        if (
          typeof o.opacity !== 'number' ||
          !Number.isFinite(o.opacity) ||
          o.opacity < 0 ||
          o.opacity > 1
        ) {
          throw new BadRequestException(
            '요소 opacity는 0 이상 1 이하 숫자여야 합니다.',
          );
        }
      }
      if (o.rotation != null) {
        if (
          typeof o.rotation !== 'number' ||
          !Number.isFinite(o.rotation) ||
          o.rotation < -360 ||
          o.rotation > 360
        ) {
          throw new BadRequestException(
            '요소 rotation은 -360~360 도 사이여야 합니다.',
          );
        }
      }
    }
  }

  private normalizePageBackgroundColor(raw: unknown): string {
    if (raw == null || raw === '') return '#ffffff';
    if (typeof raw !== 'string') {
      throw new BadRequestException('backgroundColor는 문자열이어야 합니다.');
    }
    const s = raw.trim();
    if (s.length === 0) return '#ffffff';
    if (s.length > 64) {
      throw new BadRequestException('배경색 값이 너무 깁니다.');
    }
    if (/[<>]/.test(s) || /url\s*\(/i.test(s)) {
      throw new BadRequestException('허용되지 않는 배경색입니다.');
    }
    return s;
  }

  private normalizeBookSlideSize(
    widthRaw: unknown,
    heightRaw: unknown,
  ): { width: number; height: number } {
    const w =
      typeof widthRaw === 'number' && Number.isFinite(widthRaw)
        ? widthRaw
        : DEFAULT_PAGE_W;
    const h =
      typeof heightRaw === 'number' && Number.isFinite(heightRaw)
        ? heightRaw
        : DEFAULT_PAGE_H;
    if (w < 100 || w > 4000 || h < 100 || h > 4000) {
      throw new BadRequestException(
        '슬라이드 크기(너비·높이)가 올바르지 않습니다.',
      );
    }
    return { width: w, height: h };
  }

  private normalizePagesInput(pages: BookPageInput[] | undefined): Array<{
    sortOrder: number;
    name: string;
    backgroundColor: string;
    elements: unknown[];
  }> {
    if (pages == null || pages.length === 0) {
      return [
        {
          sortOrder: 0,
          name: '',
          backgroundColor: '#ffffff',
          elements: [],
        },
      ];
    }
    if (pages.length > MAX_PAGES) {
      throw new BadRequestException(`페이지는 최대 ${MAX_PAGES}장까지입니다.`);
    }
    const sorted = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      if (typeof p.sortOrder !== 'number' || !Number.isFinite(p.sortOrder)) {
        throw new BadRequestException('sortOrder가 올바르지 않습니다.');
      }
      if (p.name != null) {
        if (typeof p.name !== 'string' || p.name.length > PAGE_NAME_MAX) {
          throw new BadRequestException(
            `페이지 이름은 ${PAGE_NAME_MAX}자 이하여야 합니다.`,
          );
        }
      }
      const elements = p.elements ?? [];
      this.validateElements(elements);
      this.normalizePageBackgroundColor(p.backgroundColor);
    }
    return sorted.map((p) => ({
      sortOrder: p.sortOrder,
      name:
        typeof p.name === 'string' ? p.name.trim().slice(0, PAGE_NAME_MAX) : '',
      backgroundColor: this.normalizePageBackgroundColor(p.backgroundColor),
      elements: p.elements ?? [],
    }));
  }

  async findPage(
    skip: number,
    take: number,
    search?: string,
  ): Promise<{ items: BookListItemPublic[]; total: number }> {
    const qb = this.bookRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.author', 'author');

    const term = search?.trim().slice(0, 120);
    if (term) {
      qb.andWhere('b.title LIKE :q', { q: `%${term}%` });
    }

    const total = await qb.clone().getCount();
    const rows = await qb
      .orderBy('b.updatedAt', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();

    const ids = rows.map((r) => r.id);
    const countMap = new Map<number, number>();
    const firstPageByBookId = new Map<number, BookPage>();
    if (ids.length > 0) {
      const raw = await this.pageRepo
        .createQueryBuilder('p')
        .select('p.bookId', 'bookId')
        .addSelect('COUNT(1)', 'cnt')
        .where('p.bookId IN (:...ids)', { ids })
        .groupBy('p.bookId')
        .getRawMany<{ bookId: number; cnt: string }>();
      for (const r of raw) {
        countMap.set(Number(r.bookId), Number(r.cnt));
      }

      const orderedPages = await this.pageRepo.find({
        where: { book: { id: In(ids) } },
        relations: ['book'],
        order: { sortOrder: 'ASC', id: 'ASC' },
      });
      for (const p of orderedPages) {
        const bid = p.book?.id;
        if (bid == null) continue;
        if (!firstPageByBookId.has(bid)) firstPageByBookId.set(bid, p);
      }
    }

    const items: BookListItemPublic[] = rows.map((b) => {
      const fp = firstPageByBookId.get(b.id);
      let coverPreview: BookListCoverPreviewPublic | null = null;
      if (fp) {
        try {
          const elements = this.parseElementsJson(fp.elementsJson || '[]');
          coverPreview = {
            slideWidth: b.slideWidth ?? DEFAULT_PAGE_W,
            slideHeight: b.slideHeight ?? DEFAULT_PAGE_H,
            backgroundColor: fp.backgroundColor?.trim() || '#ffffff',
            elements,
          };
        } catch {
          coverPreview = {
            slideWidth: b.slideWidth ?? DEFAULT_PAGE_W,
            slideHeight: b.slideHeight ?? DEFAULT_PAGE_H,
            backgroundColor: fp.backgroundColor?.trim() || '#ffffff',
            elements: [],
          };
        }
      }
      return {
        id: b.id,
        title: b.title,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        author: this.mapAuthor(b.author),
        pageCount: countMap.get(b.id) ?? 0,
        coverPreview,
      };
    });

    return { items, total };
  }

  async findOne(id: number): Promise<BookPublic> {
    const book = await this.bookRepo.findOne({
      where: { id },
      relations: ['author', 'pages'],
    });
    if (!book) throw new NotFoundException('북을 찾을 수 없습니다.');

    const pages = [...(book.pages ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    return {
      id: book.id,
      title: book.title,
      slideWidth: book.slideWidth ?? DEFAULT_PAGE_W,
      slideHeight: book.slideHeight ?? DEFAULT_PAGE_H,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      author: this.mapAuthor(book.author),
      pages: pages.map((p) => ({
        id: p.id,
        sortOrder: p.sortOrder,
        name: p.slideName ?? '',
        backgroundColor: p.backgroundColor?.trim() || '#ffffff',
        elements: this.parseElementsJson(p.elementsJson || '[]'),
      })),
    };
  }

  async create(
    userId: number,
    body: {
      title: string;
      pages?: BookPageInput[];
      slideWidth?: number;
      slideHeight?: number;
    },
  ): Promise<BookPublic> {
    const title = body.title?.trim() ?? '';
    if (!title) throw new BadRequestException('제목을 입력하세요.');
    if (title.length > TITLE_MAX) {
      throw new BadRequestException(`제목은 ${TITLE_MAX}자 이하입니다.`);
    }

    const normalized = this.normalizePagesInput(body.pages);
    const { width: sw, height: sh } = this.normalizeBookSlideSize(
      body.slideWidth,
      body.slideHeight,
    );

    const book = this.bookRepo.create({
      title,
      author: { id: userId },
      slideWidth: sw,
      slideHeight: sh,
    });
    await this.bookRepo.save(book);

    for (const p of normalized) {
      const elements = p.elements ?? [];
      this.validateElements(elements);
      await this.pageRepo.save(
        this.pageRepo.create({
          book: { id: book.id },
          sortOrder: p.sortOrder,
          slideName: p.name,
          backgroundColor: p.backgroundColor,
          elementsJson: JSON.stringify(elements),
        }),
      );
    }

    return this.findOne(book.id);
  }

  async update(
    bookId: number,
    userId: number,
    body: {
      title?: string;
      pages?: BookPageInput[];
      slideWidth?: number;
      slideHeight?: number;
    },
  ): Promise<BookPublic> {
    const book = await this.bookRepo.findOne({
      where: { id: bookId },
      relations: ['author'],
    });
    if (!book) throw new NotFoundException('북을 찾을 수 없습니다.');
    if (Number(book.author.id) !== Number(userId)) {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }

    if (body.title != null) {
      const title = body.title.trim();
      if (!title) throw new BadRequestException('제목을 입력하세요.');
      if (title.length > TITLE_MAX) {
        throw new BadRequestException(`제목은 ${TITLE_MAX}자 이하입니다.`);
      }
      book.title = title;
      await this.bookRepo.save(book);
    }

    if (body.slideWidth != null || body.slideHeight != null) {
      const { width, height } = this.normalizeBookSlideSize(
        body.slideWidth ?? book.slideWidth ?? DEFAULT_PAGE_W,
        body.slideHeight ?? book.slideHeight ?? DEFAULT_PAGE_H,
      );
      book.slideWidth = width;
      book.slideHeight = height;
      await this.bookRepo.save(book);
    }

    if (body.pages != null) {
      const normalized = this.normalizePagesInput(body.pages);
      await this.pageRepo.delete({ book: { id: bookId } });
      for (const p of normalized) {
        const elements = p.elements ?? [];
        this.validateElements(elements);
        await this.pageRepo.save(
          this.pageRepo.create({
            book: { id: bookId },
            sortOrder: p.sortOrder,
            slideName: p.name,
            backgroundColor: p.backgroundColor,
            elementsJson: JSON.stringify(elements),
          }),
        );
      }
    }

    return this.findOne(bookId);
  }

  async remove(bookId: number, userId: number): Promise<void> {
    const book = await this.bookRepo.findOne({
      where: { id: bookId },
      relations: ['author'],
    });
    if (!book) throw new NotFoundException('북을 찾을 수 없습니다.');
    if (Number(book.author.id) !== Number(userId)) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }
    /* DB에 ON DELETE CASCADE가 없으면 페이지 행 때문에 삭제가 실패할 수 있어 명시적으로 먼저 제거 */
    await this.pageRepo.delete({ book: { id: bookId } });
    await this.bookRepo.delete(bookId);
  }

  async assertBookOwner(bookId: number, userId: number): Promise<Book> {
    const b = await this.bookRepo.findOne({
      where: { id: bookId },
      relations: ['author'],
    });
    if (!b) throw new NotFoundException('북을 찾을 수 없습니다.');
    if (Number(b.author.id) !== Number(userId)) {
      throw new ForbiddenException('업로드 권한이 없습니다.');
    }
    return b;
  }

  mapUploadedFile(file: Express.Multer.File): {
    kind: 'image' | 'video';
    url: string;
  } {
    const imageMime = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ]);
    const videoMime = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
    if (imageMime.has(file.mimetype)) {
      return { kind: 'image', url: this.imagePublicUrl(file.filename) };
    }
    if (videoMime.has(file.mimetype)) {
      return { kind: 'video', url: this.videoPublicUrl(file.filename) };
    }
    throw new BadRequestException('지원하지 않는 파일 형식입니다.');
  }

  mapPosterFile(file: Express.Multer.File): string {
    return this.posterPublicUrl(file.filename);
  }
}
