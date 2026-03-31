import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  BooksDomainSpanInterceptor,
  BooksDomainSpanMiddleware,
} from './books-domain-span';
import { BookPage } from './book-page.entity';
import { Book } from './book.entity';
import { BooksAiController } from './book-ai.controller';
import { BookAiService } from './book-ai.service';
import { PexelsService } from './pexels.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [TypeOrmModule.forFeature([Book, BookPage]), AuthModule],
  controllers: [BooksController, BooksAiController],
  providers: [
    BooksService,
    PexelsService,
    BookAiService,
    BooksDomainSpanMiddleware,
    BooksDomainSpanInterceptor,
  ],
})
export class BooksModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(BooksDomainSpanMiddleware)
      .forRoutes(BooksController, BooksAiController);
  }
}
