import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { JWT_REFRESH_EXPIRES_IN, JWT_REFRESH_SECRET } from '../env.constants';
import { JwtPayload } from './types/jwt-payload.type';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './refresh-token.entity';
import { hashRefreshToken } from './refresh-token-hash';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async signup(email: string, password: string, name: string) {
    const emailNorm = email.trim();
    this.logger.log(`[회원가입] 시도 email=${emailNorm}`);
    if (!name?.trim()) {
      this.logger.warn(`[회원가입] 거절: 이름 없음 email=${emailNorm}`);
      throw new BadRequestException('이름을 입력해 주세요.');
    }
    const existing = await this.usersService.findByEmail(emailNorm);
    if (existing) {
      this.logger.warn(`[회원가입] 거절: 이메일 중복 email=${emailNorm}`);
      throw new ConflictException('이미 가입된 이메일입니다.');
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await this.usersService.create(emailNorm, hashed, name);
    this.logger.log(
      `[회원가입] 완료 userId=${user.id} email=${user.email} name=${user.name}`,
    );
    return user;
  }

  private signAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  private signRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: JWT_REFRESH_SECRET,
      expiresIn: JWT_REFRESH_EXPIRES_IN,
    });
  }

  private decodeRefreshExp(refreshToken: string): Date {
    const parts = refreshToken.split('.');
    if (parts.length < 2) {
      throw new Error('refresh token missing exp');
    }
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const payload = JSON.parse(
      Buffer.from(b64 + pad, 'base64').toString('utf8'),
    ) as { exp?: unknown };
    if (typeof payload.exp !== 'number') {
      throw new Error('refresh token missing exp');
    }
    return new Date(payload.exp * 1000);
  }

  private async persistRefreshToken(
    userId: number,
    refreshToken: string,
  ): Promise<void> {
    const expiresAt = this.decodeRefreshExp(refreshToken);
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt,
      }),
    );
  }

  /** 로그아웃·세션 폐기: 쿠키에 담긴 값과 동일한 해시의 행만 삭제 */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.refreshTokenRepo.delete({
      tokenHash: hashRefreshToken(rawToken),
    });
  }

  async signin(email: string, password: string) {
    this.logger.log(`[로그인] 시도 email=${email}`);
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      this.logger.warn(`[로그인] 실패: 계정 없음 email=${email}`);
      throw new UnauthorizedException();
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      this.logger.warn(`[로그인] 실패: 비밀번호 불일치 userId=${user.id}`);
      throw new UnauthorizedException();
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    const access_token = this.signAccessToken(payload);
    const refresh_token = this.signRefreshToken(payload);
    await this.persistRefreshToken(user.id, refresh_token);

    this.logger.log(`[로그인] 성공 userId=${user.id} email=${user.email}`);
    return {
      access_token,
      refresh_token,
    };
  }

  async refresh(refreshToken: string) {
    this.logger.log('[토큰 갱신] 리프레시 검증 시도');
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: JWT_REFRESH_SECRET,
      });
    } catch {
      this.logger.warn('[토큰 갱신] 실패: JWT 검증 오류');
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findByEmail(payload.email);
    if (!user || user.id !== payload.sub) {
      this.logger.warn(
        `[토큰 갱신] 실패: 사용자 불일치 또는 없음 sub=${payload.sub}`,
      );
      throw new UnauthorizedException();
    }

    const incomingHash = hashRefreshToken(refreshToken);
    const now = Date.now();

    let newRefreshToken: string;
    try {
      newRefreshToken = await this.refreshTokenRepo.manager.transaction(
        async (em) => {
          const repo = em.getRepository(RefreshToken);
          const row = await repo.findOne({
            where: { tokenHash: incomingHash, userId: user.id },
          });
          if (!row || row.expiresAt.getTime() < now) {
            throw new UnauthorizedException();
          }
          await repo.remove(row);

          const nextPayload: JwtPayload = {
            sub: user.id,
            email: user.email,
            name: user.name,
          };
          const next = this.signRefreshToken(nextPayload);
          const expiresAt = this.decodeRefreshExp(next);
          await repo.save(
            repo.create({
              userId: user.id,
              tokenHash: hashRefreshToken(next),
              expiresAt,
            }),
          );
          return next;
        },
      );
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        this.logger.warn(
          '[토큰 갱신] 실패: DB에 없거나 만료(이미 로테이션된 토큰 재사용 불가)',
        );
      }
      throw e;
    }

    this.logger.log(`[토큰 갱신] 성공 userId=${user.id} (로테이션)`);
    return {
      access_token: this.signAccessToken({
        sub: user.id,
        email: user.email,
        name: user.name,
      }),
      refresh_token: newRefreshToken,
    };
  }
}
