import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { OptionalJwtAuthGuard } from './jwt-optional.guard';
import { JWT_ACCESS_EXPIRES_IN, JWT_ACCESS_SECRET } from '../env.constants';
import { RefreshToken } from './refresh-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    forwardRef(() => UsersModule),
    JwtModule.register({
      secret: JWT_ACCESS_SECRET,
      signOptions: { expiresIn: JWT_ACCESS_EXPIRES_IN },
    }),
  ],
  providers: [AuthService, JwtStrategy, OptionalJwtAuthGuard],
  controllers: [AuthController],
  exports: [JwtModule, OptionalJwtAuthGuard],
})
export class AuthModule {}
