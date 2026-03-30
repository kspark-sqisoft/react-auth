import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import {
  WeatherDomainSpanInterceptor,
  WeatherDomainSpanMiddleware,
} from './weather-domain-span';

@Module({
  controllers: [WeatherController],
  providers: [
    WeatherService,
    WeatherDomainSpanMiddleware,
    WeatherDomainSpanInterceptor,
  ],
})
export class WeatherModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WeatherDomainSpanMiddleware).forRoutes(WeatherController);
  }
}
