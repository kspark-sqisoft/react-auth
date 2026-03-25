import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JWT_ACCESS_EXPIRES_IN, JWT_ACCESS_SECRET } from '../env.constants';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: JWT_ACCESS_SECRET,
      signOptions: { expiresIn: JWT_ACCESS_EXPIRES_IN },
    }),
  ],
  providers: [ChatGateway],
})
export class ChatModule {}
