import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChatMessage } from './chat-message.entity';
import { ChatRoom } from './chat-room.entity';

const HISTORY_PAGE = 50;

@Injectable()
export class ChatService {
  private readonly logger = new Logger('ChatService');

  constructor(
    @InjectRepository(ChatMessage)
    private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(ChatRoom)
    private readonly roomRepo: Repository<ChatRoom>,
  ) {}

  async append(
    roomId: string,
    authorId: number,
    authorName: string,
    authorImageUrl: string | null,
    body: string,
  ): Promise<ChatMessage> {
    this.logger.log(
      `[CHAT·서비스] append | roomId=${roomId} authorId=${authorId} len=${body.length}`,
    );
    const row = this.msgRepo.create({
      roomId,
      authorId,
      authorName: authorName.slice(0, 80),
      authorImageUrl,
      body,
    });
    return this.msgRepo.save(row);
  }

  /** 시간 오름차순(오래된 것 → 최신) */
  async findRecent(
    roomId: string,
    take = HISTORY_PAGE,
  ): Promise<ChatMessage[]> {
    const rows = await this.msgRepo.find({
      where: { roomId },
      order: { createdAt: 'DESC' },
      take,
    });
    return rows.reverse();
  }

  async distinctRoomIds(): Promise<string[]> {
    const raw = await this.msgRepo
      .createQueryBuilder('m')
      .select('m.roomId', 'roomId')
      .distinct(true)
      .getRawMany<{ roomId: string }>();
    return raw.map((r) => r.roomId);
  }

  async findRoomByRoomId(roomId: string): Promise<ChatRoom | null> {
    return this.roomRepo.findOne({ where: { roomId } });
  }

  /**
   * 방 메타가 없으면 생성.
   * - 기존 메시지가 있으면 가장 오래된 메시지 작성자를 방장으로 둠(이전 데이터 호환).
   * - 없으면 첫 입장자를 방장으로 둠.
   */
  async ensureRoomRecord(
    roomId: string,
    candidateId: number,
    candidateName: string,
  ): Promise<void> {
    const existing = await this.roomRepo.findOne({ where: { roomId } });
    if (existing) return;
    const first = await this.msgRepo.findOne({
      where: { roomId },
      order: { createdAt: 'ASC' },
    });
    if (first) {
      await this.roomRepo.save(
        this.roomRepo.create({
          roomId,
          ownerId: first.authorId,
          ownerName: first.authorName.slice(0, 80),
        }),
      );
      return;
    }
    await this.roomRepo.save(
      this.roomRepo.create({
        roomId,
        ownerId: candidateId,
        ownerName: candidateName.slice(0, 80),
      }),
    );
  }

  /** 서버 기동 시 메시지만 있고 chat_room 행이 없는 경우 보정 */
  async backfillRoomMetaIfMissing(roomId: string): Promise<void> {
    if (roomId === 'lobby') return;
    const existing = await this.roomRepo.findOne({ where: { roomId } });
    if (existing) return;
    const first = await this.msgRepo.findOne({
      where: { roomId },
      order: { createdAt: 'ASC' },
    });
    if (!first) return;
    await this.roomRepo.save(
      this.roomRepo.create({
        roomId,
        ownerId: first.authorId,
        ownerName: first.authorName.slice(0, 80),
      }),
    );
  }

  async getOwnerSummaries(
    roomIds: string[],
  ): Promise<Map<string, { ownerId: number; ownerName: string }>> {
    const map = new Map<string, { ownerId: number; ownerName: string }>();
    const filtered = roomIds.filter((id) => id !== 'lobby');
    if (filtered.length === 0) return map;
    const rows = await this.roomRepo.find({
      where: { roomId: In(filtered) },
    });
    for (const r of rows) {
      map.set(r.roomId, { ownerId: r.ownerId, ownerName: r.ownerName });
    }
    return map;
  }

  async deleteRoomFully(roomId: string): Promise<void> {
    this.logger.log(`[CHAT·서비스] deleteRoomFully | roomId=${roomId}`);
    await this.msgRepo.delete({ roomId });
    await this.roomRepo.delete({ roomId });
  }
}
