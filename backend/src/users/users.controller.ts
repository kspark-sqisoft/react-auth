import { Controller, Get, Logger, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: Request & { user: JwtPayload }): JwtPayload {
    const u = req.user;
    this.logger.log(`[내 정보] 조회 sub=${u.sub} email=${u.email}`);
    return u;
  }
}
