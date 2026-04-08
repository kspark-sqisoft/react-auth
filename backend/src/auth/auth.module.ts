import {
  Module,
  forwardRef,
  MiddlewareConsumer,
  NestModule,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import {
  AuthDomainSpanInterceptor,
  AuthDomainSpanMiddleware,
} from './auth-domain-span';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { OptionalJwtAuthGuard } from './jwt-optional.guard';
import { RolesGuard } from './roles.guard';
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
  providers: [
    AuthService,
    JwtStrategy,
    OptionalJwtAuthGuard,
    RolesGuard,
    AuthDomainSpanMiddleware,
    AuthDomainSpanInterceptor,
  ],
  controllers: [AuthController],
  exports: [JwtModule, OptionalJwtAuthGuard, RolesGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthDomainSpanMiddleware).forRoutes(AuthController);
  }
}
