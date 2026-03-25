import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './chat-message.entity';

const HISTORY_PAGE = 50;

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly repo: Repository<ChatMessage>,
  ) {}

  async append(
    roomId: string,
    authorId: number,
    authorName: string,
    body: string,
  ): Promise<ChatMessage> {
    const row = this.repo.create({
      roomId,
      authorId,
      authorName: authorName.slice(0, 80),
      body,
    });
    return this.repo.save(row);
  }

  /** 시간 오름차순(오래된 것 → 최신) */
  async findRecent(
    roomId: string,
    take = HISTORY_PAGE,
  ): Promise<ChatMessage[]> {
    const rows = await this.repo.find({
      where: { roomId },
      order: { createdAt: 'DESC' },
      take,
    });
    return rows.reverse();
  }

  async distinctRoomIds(): Promise<string[]> {
    const raw = await this.repo
      .createQueryBuilder('m')
      .select('m.roomId', 'roomId')
      .distinct(true)
      .getRawMany<{ roomId: string }>();
    return raw.map((r) => r.roomId);
  }

  /** 해당 방의 저장된 메시지 전부 삭제 */
  async deleteAllMessagesInRoom(roomId: string): Promise<void> {
    await this.repo.delete({ roomId });
  }
}
