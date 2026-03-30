import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { markRequestSpanStart } from './common/logging/http-request-span.log';
import { AppModule } from './app.module';
import {
  PORT,
  REFRESH_TOKEN_COOKIE,
  UPLOAD_ROOT,
  corsOrigin,
} from './env.constants';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /** 모든 HTTP 요청에 id·시작 시각 부여 → 도메인 미들웨어 `[완료]` ms 가 진입~응답 전체에 가깝게 잡힘 */
  app.use((req: Request, _res: Response, next: NextFunction) => {
    markRequestSpanStart(req);
    next();
  });

  app.useStaticAssets(UPLOAD_ROOT, { prefix: '/uploads/' });

  app.use(cookieParser());

  const origin = corsOrigin();
  app.enableCors({
    origin,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Cookie',
    ],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('react-auth API')
    .setDescription(
      '회원가입·로그인(액세스 JWT + httpOnly 리프레시 쿠키)·게시글 CRUD·이미지 업로드',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'JWT-auth',
    )
    .addCookieAuth('refresh', {
      type: 'apiKey',
      in: 'cookie',
      name: REFRESH_TOKEN_COOKIE,
    })
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
  logger.log(`Swagger UI http://localhost:${PORT}/api-docs`);

  await app.listen(PORT);
  logger.log(`HTTP 서버 시작 port=${PORT} cors=${JSON.stringify(origin)}`);
}
void bootstrap();
