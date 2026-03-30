import { createDomainSpanInterceptor } from '../common/logging/domain-span.interceptor';
import { createDomainSpanMiddleware } from '../common/logging/domain-span.middleware';

export const WeatherDomainSpanMiddleware = createDomainSpanMiddleware({
  reqTag: 'WEATHER',
  loggerContext: 'WeatherRequestLogger',
});

export const WeatherDomainSpanInterceptor = createDomainSpanInterceptor({
  reqTag: 'WEATHER',
  loggerContext: 'WeatherLoggingInterceptor',
});
