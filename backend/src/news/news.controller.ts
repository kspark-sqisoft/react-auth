import {
  Controller,
  DefaultValuePipe,
  Get,
  Logger,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { NewsHeadlinesResponseDto } from './dto/news-headlines.dto';
import { NewsService } from './news.service';

@ApiTags('news')
@Controller('news')
export class NewsController {
  private readonly logger = new Logger('NewsController');

  constructor(private readonly news: NewsService) {}

  @Get('headlines')
  @ApiOperation({
    summary: '헤드라인 뉴스(NewsAPI 프록시, 키는 서버)',
    description: 'https://newsapi.org/ top-headlines',
  })
  @ApiQuery({ name: 'country', required: false, example: 'kr' })
  @ApiQuery({
    name: 'category',
    required: false,
    description:
      'business, entertainment, general, health, science, sports, technology',
  })
  @ApiQuery({ name: 'pageSize', required: false, example: 5 })
  getHeadlines(
    @Query('country') country?: string,
    @Query('category') category?: string,
    @Query('pageSize', new DefaultValuePipe(5), ParseIntPipe) pageSize?: number,
  ): Promise<NewsHeadlinesResponseDto> {
    this.logger.log('[NEWS·컨트롤러] getHeadlines()');
    return this.news.getHeadlines(country, category, pageSize);
  }
}
