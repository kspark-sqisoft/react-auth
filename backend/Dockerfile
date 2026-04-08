# 릴리즈용 멀티스테이지: 1단계에서 빌드, 2단계에서 실행 전용 이미지
# Node.js 22 Alpine을 빌드 스테이지(builder)로 지정
FROM node:22-alpine AS builder
# 이후 명령의 작업 디렉터리를 /app으로 설정
WORKDIR /app
# 의존성 잠금 파일만 먼저 복사해 레이어 캐시 활용
COPY package.json package-lock.json ./
# package-lock 기준으로 프로덕션+개발 의존성 설치(빌드에 devDependencies 필요)
RUN npm ci
# 소스 전체 복사
COPY . .
# TypeScript → dist로 Nest 앱 컴파일
RUN npm run build

# 실행 전용 러너 스테이지(이미지 크기·공격면 최소화)
FROM node:22-alpine AS runner
# 애플리케이션 작업 디렉터리
WORKDIR /app
# Node를 프로덕션 모드로 동작
ENV NODE_ENV=production
# 헬스체크용 wget 설치(Alpine 최소 이미지에 없음)
RUN apk add --no-cache wget
# 런타임에 필요한 매니페스트만 복사
COPY package.json package-lock.json ./
# devDependencies 제외 설치(--omit=dev)
RUN npm ci --omit=dev
# 빌드 스테이지에서 컴파일된 산출물만 복사
COPY --from=builder /app/dist ./dist
# 컨테이너가 리스닝하는 API 포트 문서화
EXPOSE 3000
# 프로덕션 진입점: 컴파일된 main.js 실행
CMD ["node", "dist/main.js"]
