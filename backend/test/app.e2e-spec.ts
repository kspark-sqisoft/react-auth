/**
 * `setup-e2e-env.ts`에서 `DATABASE_PATH=:memory:` 설정 후 이 파일이 로드됨.
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /', () => {
    it('200 · Hello World!', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });
  });

  describe('POST /auth/signup', () => {
    const email = `e2e-${Date.now()}@example.com`;

    it('회원가입 후 id·email·name 반환', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email,
          password: 'e2e-password-12',
          name: 'E2E User',
        })
        .expect(201);

      const signupBody = res.body as {
        id: number;
        email: string;
        name: string;
      };
      expect(signupBody).toMatchObject({
        email,
        name: 'E2E User',
      });
      expect(typeof signupBody.id).toBe('number');
    });

    it('같은 이메일 재가입 시 409', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email,
          password: 'other-pass-12',
          name: 'Other',
        })
        .expect(409);
    });
  });

  describe('POST /auth/signin', () => {
    const email = `e2e-signin-${Date.now()}@example.com`;
    const password = 'signin-pass-12';

    beforeAll(async () => {
      await request(app.getHttpServer()).post('/auth/signup').send({
        email,
        password,
        name: 'Signin User',
      });
    });

    it('access_token JSON + Set-Cookie(리프레시)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email, password })
        .expect(201);

      const signinBody = res.body as { access_token: string };
      expect(signinBody).toHaveProperty('access_token');
      expect(typeof signinBody.access_token).toBe('string');
      const rawCookie = res.headers['set-cookie'];
      const setCookie: string[] = Array.isArray(rawCookie)
        ? rawCookie
        : typeof rawCookie === 'string'
          ? [rawCookie]
          : [];
      expect(
        setCookie.some((c: string) => c.toLowerCase().includes('httponly')),
      ).toBe(true);
    });

    it('틀린 비밀번호면 401', () => {
      return request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    });
  });

  describe('books · posts · comments (e2e)', () => {
    const email = `e2e-flow-${Date.now()}@example.com`;
    const password = 'flow-pass-1234';
    let accessToken: string;

    beforeAll(async () => {
      await request(app.getHttpServer()).post('/auth/signup').send({
        email,
        password,
        name: 'Flow User',
      });
      const res = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email, password })
        .expect(201);
      const body = res.body as { access_token: string };
      accessToken = body.access_token;
    });

    it('POST /books → GET /books에 포함', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/books')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'E2E Book' })
        .expect(201);
      const created = createRes.body as { id: number; title: string };
      expect(created.title).toBe('E2E Book');

      const listRes = await request(app.getHttpServer())
        .get('/books')
        .expect(200);
      const listBody = listRes.body as { items: { id: number }[] };
      expect(listBody.items.some((b) => b.id === created.id)).toBe(true);
    });

    it('POST /posts(multipart) → 댓글 작성', async () => {
      const postRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('title', 'E2E Post')
        .field('content', '<p>e2e body</p>')
        .expect(201);
      const post = postRes.body as { id: number };
      expect(typeof post.id).toBe('number');

      await request(app.getHttpServer())
        .post(`/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: '첫 댓글' })
        .expect(201);

      const treeRes = await request(app.getHttpServer())
        .get(`/posts/${post.id}/comments`)
        .expect(200);
      const tree = treeRes.body as { content: string }[];
      expect(Array.isArray(tree)).toBe(true);
      expect(tree.some((c) => c.content === '첫 댓글')).toBe(true);
    });
  });
});
