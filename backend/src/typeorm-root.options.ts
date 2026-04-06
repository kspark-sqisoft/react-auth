import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT,
  DB_USERNAME,
  TYPEORM_LOGGING,
  TYPEORM_SYNCHRONIZE,
} from './env.constants';

export function typeOrmRootOptions(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_NAME,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: TYPEORM_SYNCHRONIZE,
    logging: TYPEORM_LOGGING,
  };
}
