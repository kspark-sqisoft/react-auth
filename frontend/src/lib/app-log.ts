/**
 * 앱 주요 흐름 추적용 로그.
 * `import.meta.env.DEV`일 때만 출력되며, 프로덕션 빌드에서는 호출해도 아무 일도 하지 않습니다.
 */
export function appLog(scope: string, message: string, detail?: unknown): void {
  if (!import.meta.env.DEV) return;
  const tag = `[react-auth:${scope}]`;
  if (detail !== undefined) {
    console.log(tag, message, detail);
  } else {
    console.log(tag, message);
  }
}
