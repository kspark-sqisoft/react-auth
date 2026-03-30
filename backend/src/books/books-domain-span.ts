import { createDomainSpanInterceptor } from '../common/logging/domain-span.interceptor';
import { createDomainSpanMiddleware } from '../common/logging/domain-span.middleware';

export const BooksDomainSpanMiddleware = createDomainSpanMiddleware({
  reqTag: 'BOOKS',
  loggerContext: 'BooksRequestLogger',
});

export const BooksDomainSpanInterceptor = createDomainSpanInterceptor({
  reqTag: 'BOOKS',
  loggerContext: 'BooksLoggingInterceptor',
});
