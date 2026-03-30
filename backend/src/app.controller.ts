import { Controller, Get, Logger, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AppDomainSpanInterceptor } from './app-domain-span';

@ApiTags('app')
@Controller()
@UseInterceptors(AppDomainSpanInterceptor)
export class AppController {
  private readonly logger = new Logger('AppController');

  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '헬스 체크용 인사' })
  getHello(): string {
    this.logger.log('[APP-09-CTRL] getHello() 핸들러 진입');
    return this.appService.getHello();
  }
}
