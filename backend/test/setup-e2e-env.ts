/**
 * `AppModule`이 로드되기 전에 실행되어야 함 (jest `setupFiles`).
 * 로컬 개발용 DB 파일 대신 PostgreSQL(예: docker-compose.dev.yml 의 db)을 가리킵니다.
 *
 * E2E 전에 DB가 떠 있어야 합니다. 예: `docker compose -f docker-compose.dev.yml up db -d`
 */
process.env.DB_HOST = process.env.DB_HOST ?? '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT ?? '5432';
process.env.DB_USERNAME = process.env.DB_USERNAME ?? 'reactauth';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'reactauth';
process.env.DB_NAME = process.env.DB_NAME ?? 'reactauth';
process.env.TYPEORM_SYNC = process.env.TYPEORM_SYNC ?? 'true';
