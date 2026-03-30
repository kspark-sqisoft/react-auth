import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger('AppService');

  getHello(): string {
    this.logger.log('[APP-10-SVC] getHello');
    return 'Hello World!';
  }
}
