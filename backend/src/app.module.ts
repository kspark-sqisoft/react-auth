import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { typeOrmRootOptions } from './typeorm-root.options';
import { ChatModule } from './chat/chat.module';
import { BooksModule } from './books/books.module';
import { NewsModule } from './news/news.module';
import { WeatherModule } from './weather/weather.module';
import { PostsModule } from './posts/posts.module';
import { UsersModule } from './users/users.module';
import { CatsModule } from './cats/cats.module';
import {
  AppDomainSpanInterceptor,
  AppDomainSpanMiddleware,
} from './app-domain-span';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(typeOrmRootOptions()),
    UsersModule,
    AuthModule,
    PostsModule,
    BooksModule,
    ChatModule,
    WeatherModule,
    NewsModule,
    CatsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppDomainSpanMiddleware, AppDomainSpanInterceptor],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AppDomainSpanMiddleware).forRoutes(AppController);
  }
}
