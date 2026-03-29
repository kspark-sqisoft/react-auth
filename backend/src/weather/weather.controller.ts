import { Controller, Get, Query } from '@nestjs/common';
import { SeoulWeatherDto } from './dto/seoul-weather.dto';
import { WeatherService } from './weather.service';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  /** `q` 생략 시 서울. 예: `Seoul,KR`, `Busan,KR` */
  @Get('current')
  getCurrent(@Query('q') q?: string): Promise<SeoulWeatherDto> {
    return this.weather.getWeather(q);
  }

  @Get('seoul')
  getSeoul(): Promise<SeoulWeatherDto> {
    return this.weather.getSeoulWeather();
  }
}
