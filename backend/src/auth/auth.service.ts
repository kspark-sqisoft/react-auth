import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JWT_REFRESH_EXPIRES_IN, JWT_REFRESH_SECRET } from '../env.constants';
import { JwtPayload } from './types/jwt-payload.type';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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

    this.logger.log(`[로그인] 성공 userId=${user.id} email=${user.email}`);
    return {
      access_token: this.signAccessToken(payload),
      refresh_token: this.signRefreshToken(payload),
    };
  }

  async refresh(refreshToken: string) {
    this.logger.log('[토큰 갱신] 리프레시 검증 시도');
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        { secret: JWT_REFRESH_SECRET },
      );
      const user = await this.usersService.findByEmail(payload.email);
      if (!user || user.id !== payload.sub) {
        this.logger.warn(
          `[토큰 갱신] 실패: 사용자 불일치 또는 없음 sub=${payload.sub}`,
        );
        throw new UnauthorizedException();
      }
      this.logger.log(`[토큰 갱신] 성공 userId=${user.id}`);
      return {
        access_token: this.signAccessToken({
          sub: user.id,
          email: user.email,
          name: user.name,
        }),
      };
    } catch (e) {
      if (!(e instanceof UnauthorizedException)) {
        this.logger.warn('[토큰 갱신] 실패: JWT 검증 오류');
      }
      throw new UnauthorizedException();
    }
  }
}
