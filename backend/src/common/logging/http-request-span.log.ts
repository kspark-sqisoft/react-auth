import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** 미들웨어 진입 시 부여되는 짧은 요청 ID (다른 로그와 묶어서 보기) */
    requestLogId?: string;
    /** `markRequestSpanStart` 시각(ms) — 응답 완료 시 소요 시간 계산용 */
    requestLogStartedAt?: number;
  }
}

const TAG_W = 6;
const METHOD_W = 7;

/** https://no-color.org/ + TTY 일 때만 (로그 파일 리다이렉트 시 이스케이프 방지) */
function colorsEnabled(): boolean {
  return (
    process.stdout.isTTY === true &&
    process.env.NO_COLOR == null &&
    process.env.FORCE_COLOR !== '0'
  );
}

/** 진입=밝은 시안, 완료(2xx·3xx)=밝은 마젠타 / 4xx 황색 / 5xx 적색 */
const ansi = {
  open: '\x1b[96m',
  doneOk: '\x1b[95m',
  done4xx: '\x1b[93m',
  done5xx: '\x1b[91m',
  reset: '\x1b[0m',
} as const;

function colorizeSpanLabel(
  kind: 'open' | 'close',
  status: number | undefined,
  line: string,
): string {
  if (!colorsEnabled()) return line;
  if (kind === 'open') {
    return line.replace('[진입]', `${ansi.open}[진입]${ansi.reset}`);
  }
  const c =
    status != null && status >= 500
      ? ansi.done5xx
      : status != null && status >= 400
        ? ansi.done4xx
        : ansi.doneOk;
  return line.replace('[완료]', `${c}[완료]${ansi.reset}`);
}

function fit(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s.padEnd(w, ' ');
}

/** HH:MM:SS.mmm (서버 로컬 시각) */
function timeCompact(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

/** 앱 최상단(예: main.ts)에서 한 번 호출해 두면 도메인 미들웨어보다 앞 시각부터 ms 를 잴 수 있음 */
export function markRequestSpanStart(req: Request): string {
  if (req.requestLogId == null) req.requestLogId = randomUUID().slice(0, 8);
  if (req.requestLogStartedAt == null) req.requestLogStartedAt = Date.now();
  return req.requestLogId;
}

/**
 * 도메인 미들웨어 진입 한 줄: 영역 / 메서드 / 경로 / 요청ID / 시각
 */
export function logHttpSpanOpen(
  logger: Logger,
  domainTag: string,
  req: Request,
): void {
  const id = markRequestSpanStart(req);
  const path = req.originalUrl ?? req.url ?? '';
  const line = colorizeSpanLabel(
    'open',
    undefined,
    `[진입] ${fit(domainTag, TAG_W)} ${fit(req.method, METHOD_W)} ${path} │ id=${id} │ ${timeCompact()} │ → 가드·파이프·컨트롤러·서비스`,
  );
  logger.log(line);
}

/**
 * 응답 전송 직후 한 줄: 상태 코드·소요 ms·레벨(4xx/5xx 구분)
 */
export function logHttpSpanClose(
  logger: Logger,
  domainTag: string,
  req: Request,
  res: Response,
): void {
  const id = req.requestLogId ?? '--------';
  const path = req.originalUrl ?? req.url ?? '';
  const ms =
    req.requestLogStartedAt != null
      ? Date.now() - req.requestLogStartedAt
      : undefined;
  const msText = ms != null ? `${ms}ms` : '—';
  const status = res.statusCode;
  const raw = `[완료] ${fit(domainTag, TAG_W)} ${fit(req.method, METHOD_W)} ${path} │ id=${id} │ HTTP ${status} │ ${msText}`;
  const line = colorizeSpanLabel('close', status, raw);

  if (status >= 500) logger.error(line);
  else if (status >= 400) logger.warn(line);
  else logger.log(line);
}
