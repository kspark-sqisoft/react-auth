import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshToken } from './refresh-token.entity';

function fakeJwtWithExp(expSec: number): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: expSec, sub: 1 })).toString(
    'base64url',
  );
  return `${header}.${payload}.sig`;
}

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    create: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };
  let refreshRepo: {
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    jwtService = {
      sign: jest
        .fn()
        .mockImplementation((_payload: unknown, opts?: { secret?: string }) => {
          if (opts?.secret) {
            return fakeJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
          }
          return 'access.jwt.token';
        }),
    };
    refreshRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((x: object) => x),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshRepo,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('signup', () => {
    it('이름이 비어 있으면 BadRequestException', async () => {
      await expect(
        service.signup('a@b.com', 'password123', '   '),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });

    it('이미 가입된 이메일이면 ConflictException', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        password: 'x',
        name: 'Old',
      });
      await expect(
        service.signup('a@b.com', 'password123', '홍길동'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('성공 시 사용자 생성 후 반환', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        id: 42,
        email: 'new@example.com',
        name: '신규',
      });

      const user = await service.signup(
        '  new@example.com  ',
        'secretpass',
        '신규',
      );

      expect(user).toMatchObject({
        id: 42,
        email: 'new@example.com',
        name: '신규',
      });
      expect(usersService.create).toHaveBeenCalledWith(
        'new@example.com',
        expect.any(String),
        '신규',
      );
      const [, hashed] = usersService.create.mock.calls[0] as [
        string,
        string,
        string,
      ];
      const ok = await bcrypt.compare('secretpass', hashed);
      expect(ok).toBe(true);
    });
  });

  describe('signin', () => {
    it('계정 없으면 UnauthorizedException', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(service.signin('nobody@x.com', 'pw')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('비밀번호 불일치면 UnauthorizedException', async () => {
      const hash = await bcrypt.hash('right', 4);
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'u@u.com',
        password: hash,
        name: 'U',
      });
      await expect(service.signin('u@u.com', 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('성공 시 access·refresh 발급 및 리프레시 저장', async () => {
      const hash = await bcrypt.hash('good', 4);
      usersService.findByEmail.mockResolvedValue({
        id: 7,
        email: 'ok@ok.com',
        password: hash,
        name: 'OK',
      });

      const out = await service.signin('ok@ok.com', 'good');

      expect(out.access_token).toBe('access.jwt.token');
      expect(typeof out.refresh_token).toBe('string');
      expect(out.refresh_token.split('.')).toHaveLength(3);
      expect(jwtService.sign).toHaveBeenCalled();
      expect(refreshRepo.save).toHaveBeenCalled();
    });
  });

  describe('revokeRefreshToken', () => {
    it('delete를 tokenHash로 호출', async () => {
      await service.revokeRefreshToken('raw-token');
      expect(refreshRepo.delete).toHaveBeenCalled();
      const del = refreshRepo.delete as jest.MockedFunction<
        (criteria: { tokenHash: string }) => Promise<unknown>
      >;
      const first = del.mock.calls[0];
      expect(first).toBeDefined();
      const arg = first[0];
      expect(arg.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
