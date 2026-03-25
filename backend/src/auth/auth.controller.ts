import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
} from '../env.constants';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: '회원가입' })
  async signup(@Body() body: SignUpDto) {
    const user = await this.authService.signup(
      body.email,
      body.password,
      body.name,
    );
    return { id: user.id, email: user.email, name: user.name };
  }

  @Post('signin')
  @ApiOperation({
    summary: '로그인',
    description: [
      `응답 JSON의 access_token과 함께, 리프레시 JWT는 httpOnly 쿠키(${REFRESH_TOKEN_COOKIE})로도 발급됩니다.`,
      '',
      'Swagger의 Response headers에는 Set-Cookie가 안 보일 수 있습니다. 브라우저는 보안상 이 헤더를 스크립트(Swagger UI 포함)에 넘기지 않습니다. 실제 HTTP 응답에는 포함되며, 같은 오리진이면 브라우저가 쿠키를 저장합니다.',
      `확인: 개발자 도구 → Network → 해당 요청 → 응답 헤더에서 Set-Cookie, 또는 Application → Cookies → ${REFRESH_TOKEN_COOKIE}.`,
    ].join('\n'),
  })
  async signin(
    @Body() body: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh_token } = await this.authService.signin(
      body.email,
      body.password,
    );

    res.cookie(REFRESH_TOKEN_COOKIE, refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      path: '/',
    });

    return { access_token };
  }

  @Post('refresh')
  @ApiCookieAuth('refresh')
  @ApiOperation({
    summary: '액세스 토큰 갱신',
    description: `쿠키(${REFRESH_TOKEN_COOKIE})만 보냅니다. Authorize에 Bearer를 넣지 않습니다.`,
  })
  async refresh(@Req() req: Request) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[REFRESH_TOKEN_COOKIE];
    if (!token) {
      this.logger.warn('[토큰 갱신] 요청 거절: 리프레시 쿠키 없음');
      throw new UnauthorizedException();
    }
    return this.authService.refresh(token);
  }

  @Post('logout')
  @ApiOperation({
    summary: '로그아웃',
    description: '리프레시 쿠키를 제거합니다.',
  })
  logout(@Res({ passthrough: true }) res: Response) {
    this.logger.log('[로그아웃] 리프레시 쿠키 제거');
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { ok: true };
  }
}
