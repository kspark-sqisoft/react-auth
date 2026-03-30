import { createDomainSpanInterceptor } from '../common/logging/domain-span.interceptor';
import { createDomainSpanMiddleware } from '../common/logging/domain-span.middleware';

export const UsersDomainSpanMiddleware = createDomainSpanMiddleware({
  reqTag: 'USERS',
  loggerContext: 'UsersRequestLogger',
});

export const UsersDomainSpanInterceptor = createDomainSpanInterceptor({
  reqTag: 'USERS',
  loggerContext: 'UsersLoggingInterceptor',
});
