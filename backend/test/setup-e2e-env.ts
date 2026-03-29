/**
 * `AppModule`이 로드되기 전에 실행되어야 함 (jest `setupFiles`).
 * 개발용 `db.sqlite`를 건드리지 않도록 인메모리 SQLite 사용.
 */
process.env.DATABASE_PATH = ':memory:';
