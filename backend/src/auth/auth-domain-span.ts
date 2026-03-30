import { createDomainSpanInterceptor } from '../common/logging/domain-span.interceptor';
import { createDomainSpanMiddleware } from '../common/logging/domain-span.middleware';

export const AuthDomainSpanMiddleware = createDomainSpanMiddleware({
  reqTag: 'AUTH',
  loggerContext: 'AuthRequestLogger',
});

export const AuthDomainSpanInterceptor = createDomainSpanInterceptor({
  reqTag: 'AUTH',
  loggerContext: 'AuthLoggingInterceptor',
});
