import { createDomainSpanInterceptor } from '../common/logging/domain-span.interceptor';
import { createDomainSpanMiddleware } from '../common/logging/domain-span.middleware';

export const PostsDomainSpanMiddleware = createDomainSpanMiddleware({
  reqTag: 'POSTS',
  loggerContext: 'PostsRequestLogger',
});

export const PostsDomainSpanInterceptor = createDomainSpanInterceptor({
  reqTag: 'POSTS',
  loggerContext: 'PostsLoggingInterceptor',
});
