import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NewsArticleDto,
  NewsHeadlinesResponseDto,
} from './dto/news-headlines.dto';

const CATEGORIES = new Set([
  'business',
  'entertainment',
  'general',
  'health',
  'science',
  'sports',
  'technology',
]);

type NewsApiArticleRow = {
  title?: string | null;
  url?: string | null;
  source?: { name?: string | null };
  publishedAt?: string | null;
};

type NewsApiJson = {
  status?: string;
  code?: string;
  message?: string;
  totalResults?: number;
  articles?: NewsApiArticleRow[];
};

/** top-headlines가 빈 배열을 줄 때 everything으로 보조 (무료 플랜·소스 제한 대응) */
const EVERYTHING_Q_BY_COUNTRY: Record<string, string> = {
  kr: 'Korea',
  us: 'United States',
  jp: 'Japan',
  cn: 'China',
  tw: 'Taiwan',
  gb: 'United Kingdom',
  de: 'Germany',
  fr: 'France',
  in: 'India',
  br: 'Brazil',
  au: 'Australia',
  ca: 'Canada',
  ru: 'Russia',
  it: 'Italy',
  es: 'Spain',
  mx: 'Mexico',
  nl: 'Netherlands',
  se: 'Sweden',
  ch: 'Switzerland',
};

const EVERYTHING_LANG_BY_COUNTRY: Record<string, string> = {
  kr: 'ko',
  jp: 'ja',
  cn: 'zh',
  tw: 'zh',
  gb: 'en',
  us: 'en',
};

function sanitizeTitle(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

/** NewsAPI 무료/제한 구간에서 자주 오는 "[Removed]" 등 — URL도 없는 경우가 많아 스킵 */
function isRedactedOrEmptyNewsTitle(title: string): boolean {
  if (!title.trim()) return true;
  const normalized = title
    .replace(/\[/g, '')
    .replace(/\]/g, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length === 0 || /^removed$/i.test(normalized);
}

function safeHttpUrl(u: string): string | null {
  try {
    const x = new URL(u);
    if (x.protocol !== 'http:' && x.protocol !== 'https:') return null;
    return x.href.slice(0, 2048);
  } catch {
    return null;
  }
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger('NewsService');

  constructor(private readonly config: ConfigService) {}

  private mapRawArticles(
    rawList: NewsApiArticleRow[],
    pageSize: number,
  ): NewsArticleDto[] {
    const articles: NewsArticleDto[] = [];
    for (const a of rawList) {
      if (articles.length >= pageSize) break;
      const title = typeof a.title === 'string' ? sanitizeTitle(a.title) : '';
      if (isRedactedOrEmptyNewsTitle(title)) continue;
      const urlStr = typeof a.url === 'string' ? safeHttpUrl(a.url) : null;
      if (!urlStr) continue;
      const source =
        typeof a.source?.name === 'string' && a.source.name.trim()
          ? a.source.name.trim().slice(0, 120)
          : '출처 미상';
      const publishedAt =
        typeof a.publishedAt === 'string' && a.publishedAt.length > 0
          ? a.publishedAt.slice(0, 40)
          : new Date().toISOString();
      articles.push({ title, url: urlStr, source, publishedAt });
    }
    return articles;
  }

  private apiKey(): string {
    const key = this.config.get<string>('NEWSAPI_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'NEWSAPI_KEY가 설정되지 않았습니다. 백엔드 .env에 NewsAPI 키를 넣어 주세요.',
      );
    }
    return key;
  }

  /**
   * top-headlines가 빈 배열일 때만 사용. NewsAPI 무료/제한 환경에서 kr 등이 0건으로 올 때 대비.
   * @see https://newsapi.org/docs/endpoints/everything
   */
  private async fetchEverythingFallback(
    country: string,
    pageSize: number,
    key: string,
  ): Promise<NewsApiArticleRow[]> {
    const q = EVERYTHING_Q_BY_COUNTRY[country] ?? 'world news';
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const ask = Math.min(30, Math.max(pageSize * 3, 12));

    const run = async (
      withLang: string | undefined,
    ): Promise<NewsApiArticleRow[]> => {
      const params = new URLSearchParams({
        q,
        from,
        sortBy: 'publishedAt',
        pageSize: String(ask),
        apiKey: key,
      });
      if (withLang) params.set('language', withLang);

      const url = `https://newsapi.org/v2/everything?${params.toString()}`;
      this.logger.log(
        `[NEWS·서비스] everything 폴백 q="${q}" language=${withLang ?? '(생략)'} from=${from} ask=${ask}`,
      );

      let res: Response;
      try {
        res = await fetch(url);
      } catch {
        this.logger.warn('[NEWS·서비스] everything 폴백: 네트워크 오류');
        return [];
      }

      let json: NewsApiJson;
      try {
        json = (await res.json()) as NewsApiJson;
      } catch {
        this.logger.warn('[NEWS·서비스] everything 폴백: JSON 파싱 실패');
        return [];
      }

      if (json.status === 'error') {
        const msg = json.message ?? json.code ?? 'unknown';
        this.logger.warn(
          `[NEWS·서비스] everything 폴백: NewsAPI ${String(msg)}`,
        );
        return [];
      }

      if (!res.ok) {
        this.logger.warn(`[NEWS·서비스] everything 폴백: HTTP ${res.status}`);
        return [];
      }

      const rows = Array.isArray(json.articles) ? json.articles : [];
      const tr = json.totalResults;
      this.logger.log(
        `[NEWS·서비스] everything 폴백 응답 totalResults=${tr ?? '—'} 배열=${rows.length}`,
      );
      return rows;
    };

    const lang = EVERYTHING_LANG_BY_COUNTRY[country];
    let rows = await run(lang);
    if (rows.length === 0 && lang) {
      this.logger.warn(
        '[NEWS·서비스] everything 폴백: 언어 제한 재시도(영어 등 혼합)',
      );
      rows = await run(undefined);
    }
    return rows;
  }

  /**
   * NewsAPI top-headlines (https://newsapi.org/docs/endpoints/top-headlines)
   */
  async getHeadlines(
    countryRaw?: string,
    categoryRaw?: string,
    pageSizeRaw?: number,
  ): Promise<NewsHeadlinesResponseDto> {
    const key = this.apiKey();
    const country = (
      countryRaw?.trim().toLowerCase().slice(0, 2) || 'kr'
    ).replace(/[^a-z]/g, '');
    if (country.length !== 2) {
      throw new BadRequestException(
        'country는 ISO 3166-1 alpha-2 두 글자여야 합니다.',
      );
    }

    let category = '';
    if (categoryRaw?.trim()) {
      const c = categoryRaw.trim().toLowerCase();
      if (!CATEGORIES.has(c)) {
        throw new BadRequestException(
          `category는 ${[...CATEGORIES].join(', ')} 중 하나여야 합니다.`,
        );
      }
      category = c;
    }

    const pageSize = Math.min(
      10,
      Math.max(1, Math.round(Number(pageSizeRaw) || 5)),
    );

    const fetchTopHeadlines = async (cat: string) => {
      const params = new URLSearchParams({
        country,
        pageSize: String(pageSize),
        apiKey: key,
      });
      if (cat) params.set('category', cat);

      const url = `https://newsapi.org/v2/top-headlines?${params.toString()}`;
      this.logger.log(
        `[NEWS·서비스] top-headlines country=${country} category=${cat || '(없음)'} pageSize=${pageSize}`,
      );

      let res: Response;
      try {
        res = await fetch(url);
      } catch {
        throw new BadGatewayException('뉴스 API에 연결하지 못했습니다.');
      }

      let json: NewsApiJson;
      try {
        json = (await res.json()) as NewsApiJson;
      } catch {
        throw new BadGatewayException('뉴스 응답을 해석하지 못했습니다.');
      }

      if (json.status === 'error') {
        const msg = json.message ?? json.code ?? 'unknown';
        this.logger.warn(`[NEWS·서비스] NewsAPI error: ${msg}`);
        throw new BadGatewayException(
          typeof msg === 'string' && msg.length > 0
            ? `NewsAPI: ${msg}`
            : '뉴스를 가져오지 못했습니다.',
        );
      }

      if (!res.ok) {
        throw new BadGatewayException('뉴스를 가져오지 못했습니다.');
      }

      const rows = Array.isArray(json.articles) ? json.articles : [];
      const tr = json.totalResults;
      this.logger.log(
        `[NEWS·서비스] top-headlines 응답 totalResults=${tr ?? '—'} articles배열=${rows.length}`,
      );
      return rows;
    };

    let rawList = await fetchTopHeadlines(category);
    let articles: NewsArticleDto[] = this.mapRawArticles(rawList, pageSize);

    if (articles.length === 0 && category && rawList.length === 0) {
      this.logger.warn(
        `[NEWS·서비스] category=${category} 응답 0건 → 카테고리 없이 재요청`,
      );
      rawList = await fetchTopHeadlines('');
      articles = this.mapRawArticles(rawList, pageSize);
    }

    if (articles.length === 0 && rawList.length === 0) {
      this.logger.warn(
        `[NEWS·서비스] top-headlines 원본 0건 → everything 폴백 country=${country}`,
      );
      rawList = await this.fetchEverythingFallback(country, pageSize, key);
      articles = this.mapRawArticles(rawList, pageSize);
    }

    if (articles.length === 0 && rawList.length > 0) {
      this.logger.warn(
        `[NEWS·서비스] NewsAPI ${rawList.length}건 중 유효 제목·URL 없음(첫 항목 title/url 확인)`,
      );
    }

    this.logger.log(`[NEWS·서비스] 반환 기사 수=${articles.length}`);
    return {
      articles,
      fetchedAt: new Date().toISOString(),
    };
  }
}
