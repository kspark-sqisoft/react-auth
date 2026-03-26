import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JWT_ACCESS_EXPIRES_IN, JWT_ACCESS_SECRET } from '../env.constants';
import { UsersModule } from '../users/users.module';
import { ChatMessage } from './chat-message.entity';
import { ChatRoom } from './chat-room.entity';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, ChatRoom]),
    UsersModule,
    JwtModule.register({
      secret: JWT_ACCESS_SECRET,
      signOptions: { expiresIn: JWT_ACCESS_EXPIRES_IN },
    }),
  ],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
