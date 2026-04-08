# 릴리즈용: Vite 빌드 산출물을 nginx로 정적 서빙
# Node 22 Alpine으로 SPA 빌드 스테이지
FROM node:22-alpine AS builder
# 프론트 작업 디렉터리
WORKDIR /app
# 의존성 레이어 캐시를 위해 lock 파일만 먼저 복사
COPY package.json package-lock.json ./
# 빌드에 필요한 패키지 설치
RUN npm ci
# 소스·설정 전체 복사
COPY . .
# TypeScript 검사 후 Vite 프로덕션 빌드 → dist/
RUN npm run build

# 정적 파일 서빙용 nginx Alpine 러너
FROM nginx:alpine
# 빌드 산출물을 nginx 기본 웹 루트에 배치
COPY --from=builder /app/dist /usr/share/nginx/html
# API 프록시 등 커스텀 서버 블록
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 브라우저·compose에서 매핑할 HTTP 포트
EXPOSE 80
# (명시 없음) nginx 이미지 기본 CMD로 master 프로세스 기동
