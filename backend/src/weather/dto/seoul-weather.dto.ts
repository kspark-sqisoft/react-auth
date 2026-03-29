import { ApiProperty } from '@nestjs/swagger';

/** 현재 날씨·대기 응답(서울 또는 쿼리 지역) */
export class SeoulWeatherDto {
  @ApiProperty()
  locationLabel!: string;

  @ApiProperty()
  tempC!: number;

  @ApiProperty()
  feelsLikeC!: number;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  icon!: string;

  @ApiProperty()
  humidity!: number;

  @ApiProperty()
  windMps!: number;

  @ApiProperty({ nullable: true })
  pm25!: number | null;

  @ApiProperty({ nullable: true })
  pm10!: number | null;

  @ApiProperty({ nullable: true })
  aqiLevel!: number | null;

  @ApiProperty({ nullable: true })
  aqiLabel!: string | null;

  @ApiProperty()
  updatedAt!: string;
}
