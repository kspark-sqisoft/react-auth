import { createDomainSpanInterceptor } from './common/logging/domain-span.interceptor';
import { createDomainSpanMiddleware } from './common/logging/domain-span.middleware';

export const AppDomainSpanMiddleware = createDomainSpanMiddleware({
  reqTag: 'APP',
  loggerContext: 'AppRequestLogger',
});

export const AppDomainSpanInterceptor = createDomainSpanInterceptor({
  reqTag: 'APP',
  loggerContext: 'AppLoggingInterceptor',
});
