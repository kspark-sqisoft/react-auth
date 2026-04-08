import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_ACCESS_SECRET } from '../env.constants';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user-role';
import { assertJwtSubToUserId } from './jwt-sub.util';
import { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      secretOrKey: JWT_ACCESS_SECRET,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const sub = assertJwtSubToUserId(payload.sub);
    const user = await this.usersService.findByIdForAuth(sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      sub: user.id,
      email: user.email,
      name: user.name ?? '',
      role: user.role ?? UserRole.User,
    };
  }
}
