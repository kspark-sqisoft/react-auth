import {
  Module,
  forwardRef,
  MiddlewareConsumer,
  NestModule,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import {
  UsersDomainSpanInterceptor,
  UsersDomainSpanMiddleware,
} from './users-domain-span';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), forwardRef(() => AuthModule)],
  providers: [
    UsersService,
    UsersDomainSpanMiddleware,
    UsersDomainSpanInterceptor,
  ],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(UsersDomainSpanMiddleware).forRoutes(UsersController);
  }
}
