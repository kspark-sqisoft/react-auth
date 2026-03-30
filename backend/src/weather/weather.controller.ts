import {
  Controller,
  Get,
  Logger,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SeoulWeatherDto } from './dto/seoul-weather.dto';
import { WeatherService } from './weather.service';
import { WeatherDomainSpanInterceptor } from './weather-domain-span';

@ApiTags('weather')
@Controller('weather')
@UseInterceptors(WeatherDomainSpanInterceptor)
export class WeatherController {
  private readonly logger = new Logger('WeatherController');

  constructor(private readonly weather: WeatherService) {}

  /** `q` 생략 시 서울. 예: `Seoul,KR`, `Busan,KR` */
  @Get('current')
  @ApiOperation({ summary: '현재 날씨(q 생략 시 서울)' })
  getCurrent(@Query('q') q?: string): Promise<SeoulWeatherDto> {
    this.logger.log('[WEATHER-09-CTRL] getCurrent() 핸들러 진입');
    return this.weather.getWeather(q);
  }

  @Get('seoul')
  @ApiOperation({ summary: '서울 날씨(하위 호환)' })
  getSeoul(): Promise<SeoulWeatherDto> {
    this.logger.log('[WEATHER-09-CTRL] getSeoul() 핸들러 진입');
    return this.weather.getSeoulWeather();
  }
}
