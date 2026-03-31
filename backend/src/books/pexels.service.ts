import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type PexelsSearchJson = {
  photos?: {
    width: number;
    height: number;
    src?: { large?: string; large2x?: string; original?: string };
  }[];
};

type PexelsVideoFile = {
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
};

type PexelsVideoItem = {
  width: number;
  height: number;
  duration: number;
  image: string;
  video_files?: PexelsVideoFile[];
};

type PexelsVideoSearchJson = {
  videos?: PexelsVideoItem[];
};

/**
 * https://www.pexels.com/api/ — 헤더는 `Authorization: <API_KEY>` (Bearer 아님).
 */
@Injectable()
export class PexelsService {
  private readonly logger = new Logger(PexelsService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * 첫 번째 검색 결과의 큰 이미지 URL. 키 없음·오류·결과 없음 → null.
   */
  async searchFirstPhoto(
    query: string,
  ): Promise<{ url: string; width: number; height: number } | null> {
    const key = this.config.get<string>('PEXELS_API_KEY')?.trim();
    if (!key) {
      this.logger.debug('PEXELS_API_KEY 없음 — 이미지 검색 생략');
      return null;
    }
    const q = query.trim().slice(0, 200);
    if (!q) return null;

    const pickFirst = (
      data: PexelsSearchJson,
    ): { url: string; width: number; height: number } | null => {
      const p = data.photos?.[0];
      const src = p?.src?.large2x ?? p?.src?.large ?? p?.src?.original;
      if (!p || !src) return null;
      return {
        url: src,
        width: Math.max(1, p.width),
        height: Math.max(1, p.height),
      };
    };

    const search = async (orientation: 'landscape' | undefined) => {
      const o = orientation ? `&orientation=${orientation}` : '';
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15${o}`;
      const res = await fetch(url, {
        headers: { Authorization: key },
      });
      if (!res.ok) {
        this.logger.warn(`Pexels HTTP ${res.status}`);
        return null;
      }
      return (await res.json()) as PexelsSearchJson;
    };

    try {
      let data = await search('landscape');
      let hit = data ? pickFirst(data) : null;
      if (!hit) {
        data = await search(undefined);
        hit = data ? pickFirst(data) : null;
      }
      return hit;
    } catch (e) {
      this.logger.warn(`Pexels fetch 실패: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * 짧은 가로형 클립 우선(max 25s). 가장 작은 해상도 파일을 고름.
   * 이미지 API와 달리 동영상은 항목에 MP4가 없고 WebM 등만 있는 경우가 많아,
   * MP4 → WebM → 기타 video/*(HLS 제외) 순으로 폴백합니다.
   */
  async searchFirstVideo(query: string): Promise<{
    videoUrl: string;
    posterUrl: string;
    width: number;
    height: number;
    duration: number;
  } | null> {
    const key = this.config.get<string>('PEXELS_API_KEY')?.trim();
    if (!key) {
      this.logger.debug('PEXELS_API_KEY 없음 — 동영상 검색 생략');
      return null;
    }
    const q = query.trim().slice(0, 200);
    if (!q) {
      this.logger.warn('[pexels:video] 빈 검색어');
      return null;
    }

    this.logger.log(
      `[pexels:video] 검색 시작 query="${q.length > 72 ? `${q.slice(0, 72)}…` : q}"`,
    );

    const isHttps = (f: PexelsVideoFile) =>
      typeof f.link === 'string' && /^https:\/\//i.test(f.link);

    const pickSmallest = (
      files: PexelsVideoFile[],
      pred: (f: PexelsVideoFile) => boolean,
    ): PexelsVideoFile | null => {
      const cands = files.filter((f) => isHttps(f) && pred(f));
      if (!cands.length) return null;
      cands.sort((a, b) => a.width - b.width || a.height - b.height);
      return cands[0] ?? null;
    };

    const looksMp4 = (f: PexelsVideoFile) => {
      const ft = String(f.file_type ?? '').toLowerCase();
      return ft.includes('mp4') || /\.mp4(\?|$)/i.test(f.link);
    };
    const looksWebm = (f: PexelsVideoFile) => {
      const ft = String(f.file_type ?? '').toLowerCase();
      return ft.includes('webm') || /\.webm(\?|$)/i.test(f.link);
    };
    /** 스트리밍(HLS) 말고 브라우저 <video>에 넣기 적합한 단일 파일 위주 */
    const looksOtherProgressiveVideo = (f: PexelsVideoFile) => {
      const ft = String(f.file_type ?? '').toLowerCase();
      if (/\.m3u8(\?|$)/i.test(f.link)) return false;
      if (ft.includes('mpegurl') || ft.includes('hls')) return false;
      if (/\.mov(\?|$)/i.test(f.link)) return true;
      return ft.startsWith('video/');
    };

    const pickPlayableFile = (v: PexelsVideoItem): PexelsVideoFile | null => {
      const files = v.video_files ?? [];
      return (
        pickSmallest(files, looksMp4) ??
        pickSmallest(files, looksWebm) ??
        pickSmallest(files, looksOtherProgressiveVideo)
      );
    };

    const pickFromResponse = (
      data: PexelsVideoSearchJson | null,
      maxDurationSec: number,
    ): {
      videoUrl: string;
      posterUrl: string;
      width: number;
      height: number;
      duration: number;
    } | null => {
      const list = [...(data?.videos ?? [])].sort(
        (a, b) =>
          (typeof a.duration === 'number' ? a.duration : 999) -
          (typeof b.duration === 'number' ? b.duration : 999),
      );
      for (const v of list) {
        const dur =
          typeof v.duration === 'number' && Number.isFinite(v.duration)
            ? v.duration
            : 0;
        if (dur > maxDurationSec) continue;
        const f = pickPlayableFile(v);
        if (!f || typeof v.image !== 'string' || !v.image.trim()) continue;
        return {
          videoUrl: f.link,
          posterUrl: v.image.trim(),
          width: Math.max(1, f.width),
          height: Math.max(1, f.height),
          duration: Math.max(1, Math.round(dur)),
        };
      }
      return null;
    };

    const fetchSearch = async (
      orientation: 'landscape' | undefined,
      maxDuration: number | undefined,
    ) => {
      const o = orientation ? `&orientation=${orientation}` : '';
      const md = maxDuration != null ? `&max_duration=${maxDuration}` : '';
      const url = `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(q)}&per_page=20${md}${o}`;
      const res = await fetch(url, { headers: { Authorization: key } });
      if (!res.ok) {
        this.logger.warn(`Pexels videos HTTP ${res.status}`);
        return null;
      }
      return (await res.json()) as PexelsVideoSearchJson;
    };

    try {
      const attempts: {
        orientation: 'landscape' | undefined;
        maxDuration: number | undefined;
        pickMax: number;
      }[] = [
        { orientation: 'landscape', maxDuration: 25, pickMax: 25 },
        { orientation: undefined, maxDuration: 25, pickMax: 25 },
        { orientation: 'landscape', maxDuration: undefined, pickMax: 35 },
        { orientation: undefined, maxDuration: undefined, pickMax: 35 },
      ];

      for (const att of attempts) {
        const data = await fetchSearch(att.orientation, att.maxDuration);
        const n = data?.videos?.length ?? 0;
        const hit = pickFromResponse(data, att.pickMax);
        const orient = att.orientation ?? 'any';
        const md =
          att.maxDuration != null ? `maxDur=${att.maxDuration}` : 'noMaxDur';
        if (hit) {
          let host = '';
          try {
            host = new URL(hit.videoUrl).hostname;
          } catch {
            host = '?';
          }
          this.logger.log(
            `[pexels:video] 성공 attempt orient=${orient} ${md} pickMax=${att.pickMax} rawCount=${n} → host=${host} ${hit.width}x${hit.height} ~${hit.duration}s (브라우저 재생 시 CDN에서 추가 다운로드·시간 소요 가능)`,
          );
          return hit;
        }
        this.logger.warn(
          `[pexels:video] 이번 시도 무결과 orient=${orient} ${md} pickMax=${att.pickMax} rawCount=${n} (재생 파일 없음·길이 초과·API 빈 결과 등)`,
        );
      }
      this.logger.warn(
        `[pexels:video] 전체 시도 실패 query="${q.slice(0, 60)}${q.length > 60 ? '…' : ''}"`,
      );
      return null;
    } catch (e) {
      this.logger.warn(`Pexels videos fetch 실패: ${(e as Error).message}`);
      return null;
    }
  }
}
