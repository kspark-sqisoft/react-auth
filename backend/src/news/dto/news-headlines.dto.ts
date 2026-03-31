import { ApiProperty } from '@nestjs/swagger';

export class NewsArticleDto {
  @ApiProperty({ description: '기사 제목' })
  title!: string;

  @ApiProperty({ description: '원문 URL' })
  url!: string;

  @ApiProperty({ description: '출처 이름' })
  source!: string;

  @ApiProperty({ description: '게시 시각(ISO)' })
  publishedAt!: string;
}

/** NewsAPI top-headlines 프록시 응답 */
export class NewsHeadlinesResponseDto {
  @ApiProperty({ type: [NewsArticleDto] })
  articles!: NewsArticleDto[];

  @ApiProperty()
  fetchedAt!: string;
}
