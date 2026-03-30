import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger('AppService');

  getHello(): string {
    this.logger.log('[APP·서비스] getHello');
    return 'Hello World!';
  }
}
