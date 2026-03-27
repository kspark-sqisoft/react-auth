import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { parseJwtSubToUserId } from '../auth/jwt-sub.util';
import { JWT_ACCESS_SECRET, corsOrigin } from '../env.constants';
import { UsersService } from '../users/users.service';
import { ChatMessage } from './chat-message.entity';
import { ChatService } from './chat.service';

const MAX_MESSAGE_LEN = 2000;
const MAX_ROOM_ID_LEN = 64;
const HISTORY_LIMIT = 50;

type ClientData = {
  userId: number;
  name: string;
  currentRoom?: string;
};

export type RoomListEntry = {
  id: string;
  members: number;
  ownerId?: number;
  ownerName?: string;
};

export type ChatMessageWire = {
  id: string;
  roomId: string;
  userId: number;
  userName: string;
  /** 발신 시점 프로필 이미지 경로(`/uploads/...`), 없으면 null */
  userImageUrl: string | null;
  text: string;
  createdAt: string;
};

function sanitizeRoomId(raw: unknown): string {
  if (typeof raw !== 'string') return 'lobby';
  const t = raw.trim().toLowerCase().replace(/\s+/g, '-');
  const safe = t.replace(/[^a-z0-9가-힣._-]/g, '').slice(0, MAX_ROOM_ID_LEN);
  return safe || 'lobby';
}

function toWireMessages(rows: ChatMessage[]): ChatMessageWire[] {
  return rows.map((m) => ({
    id: String(m.id),
    roomId: m.roomId,
    userId: m.authorId,
    userName: m.authorName,
    userImageUrl: m.authorImageUrl ?? null,
    text: m.body,
    createdAt: m.createdAt.toISOString(),
  }));
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: corsOrigin(),
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  private readonly roomMembers = new Map<string, number>();
  private readonly knownRooms = new Set<string>(['lobby']);

  constructor(
    private readonly jwt: JwtService,
    private readonly chatService: ChatService,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const ids = await this.chatService.distinctRoomIds();
      for (const id of ids) {
        this.knownRooms.add(id);
        if (id !== 'lobby') {
          await this.chatService.backfillRoomMetaIfMissing(id);
        }
      }
      this.knownRooms.add('lobby');
    } catch (e) {
      this.logger.warn(`[채팅] DB 방 목록 로드 실패: ${String(e)}`);
    }
  }

  private incRoom(room: string): void {
    this.knownRooms.add(room);
    this.roomMembers.set(room, (this.roomMembers.get(room) ?? 0) + 1);
  }

  private decRoom(room: string): void {
    const n = (this.roomMembers.get(room) ?? 0) - 1;
    if (n <= 0) {
      this.roomMembers.delete(room);
    } else {
      this.roomMembers.set(room, n);
    }
  }

  private buildRoomList(
    owners: Map<string, { ownerId: number; ownerName: string }>,
  ): RoomListEntry[] {
    return Array.from(this.knownRooms)
      .map((id) => {
        const o = owners.get(id);
        const base: RoomListEntry = {
          id,
          members: this.roomMembers.get(id) ?? 0,
        };
        if (id !== 'lobby' && o) {
          base.ownerId = o.ownerId;
          base.ownerName = o.ownerName;
        }
        return base;
      })
      .sort((a, b) => {
        if (a.id === 'lobby') return -1;
        if (b.id === 'lobby') return 1;
        if (b.members !== a.members) return b.members - a.members;
        return a.id.localeCompare(b.id);
      });
  }

  private async getRoomListPayload(): Promise<RoomListEntry[]> {
    const owners = await this.chatService.getOwnerSummaries(
      Array.from(this.knownRooms),
    );
    return this.buildRoomList(owners);
  }

  private emitRoomList(): void {
    void this.emitRoomListAsync();
  }

  private async emitRoomListAsync(): Promise<void> {
    try {
      const rooms = await this.getRoomListPayload();
      this.server.emit('roomList', { rooms });
    } catch (e) {
      this.logger.warn(`[채팅] roomList 전송 실패: ${String(e)}`);
    }
  }

  private async emitMessageHistory(
    client: Socket,
    room: string,
  ): Promise<void> {
    const rows = await this.chatService.findRecent(room, HISTORY_LIMIT);
    client.emit('messageHistory', {
      roomId: room,
      messages: toWireMessages(rows),
    });
  }

  async handleConnection(client: Socket) {
    const tokenRaw =
      (client.handshake.auth as { token?: unknown })?.token ??
      client.handshake.query?.token;
    const token = typeof tokenRaw === 'string' ? tokenRaw : null;
    if (!token) {
      client.emit('chatError', { message: '로그인이 필요합니다.' });
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: JWT_ACCESS_SECRET,
      });
      const subId = parseJwtSubToUserId(payload.sub);
      if (subId == null) {
        client.emit('chatError', { message: '토큰이 유효하지 않습니다.' });
        client.disconnect(true);
        return;
      }
      const data: ClientData = {
        userId: subId,
        name: (payload.name?.trim() || payload.email || 'user').slice(0, 80),
      };
      (client.data as ClientData) = data;
      this.logger.log(`[채팅] 연결 socket=${client.id} userId=${data.userId}`);
      const rooms = await this.getRoomListPayload();
      client.emit('roomList', { rooms });
    } catch {
      client.emit('chatError', {
        message: '토큰이 만료되었거나 유효하지 않습니다.',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const d = client.data as ClientData;
    if (d?.userId != null) {
      this.logger.log(
        `[채팅] 연결 해제 socket=${client.id} userId=${d.userId}`,
      );
    }
    const room = d?.currentRoom;
    if (room) {
      void client.leave(room);
      this.decRoom(room);
      d.currentRoom = undefined;
      this.emitRoomList();
    }
  }

  @SubscribeMessage('getRoomList')
  async handleGetRoomList() {
    const rooms = await this.getRoomListPayload();
    return { rooms };
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: string },
  ) {
    const me = client.data as ClientData;
    if (me?.userId == null) return { ok: false };

    const room = sanitizeRoomId(body?.roomId);
    if (room !== 'lobby') {
      await this.chatService.ensureRoomRecord(room, me.userId, me.name);
    }

    if (me.currentRoom === room) {
      client.emit('joinedRoom', { roomId: room });
      await this.emitMessageHistory(client, room);
      return { ok: true, roomId: room };
    }

    const prev = me.currentRoom;
    if (prev) {
      void client.leave(prev);
      this.decRoom(prev);
    }
    void client.join(room);
    this.knownRooms.add(room);
    this.incRoom(room);
    me.currentRoom = room;

    client.emit('joinedRoom', { roomId: room });
    await this.emitMessageHistory(client, room);

    let joinName = me.name;
    let joinImageUrl: string | null = null;
    try {
      const profile = await this.usersService.getMeProfile(me.userId);
      joinName = profile.name;
      joinImageUrl = profile.imageUrl;
    } catch {
      joinImageUrl = null;
    }
    client.to(room).emit('systemNotice', {
      type: 'join',
      roomId: room,
      userId: me.userId,
      userName: joinName,
      userImageUrl: joinImageUrl,
      at: new Date().toISOString(),
    });
    this.emitRoomList();
    return { ok: true, roomId: room };
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const me = client.data as ClientData;
    const room = me?.currentRoom;
    if (!room) return { ok: true };
    void client.leave(room);
    this.decRoom(room);
    me.currentRoom = undefined;
    client.emit('leftRoom', { roomId: room });
    this.emitRoomList();
    return { ok: true };
  }

  @SubscribeMessage('deleteRoom')
  async handleDeleteRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: string },
  ) {
    const me = client.data as ClientData;
    if (me?.userId == null) return { ok: false };

    const room = sanitizeRoomId(body?.roomId);
    if (room === 'lobby') {
      client.emit('chatError', { message: '로비는 삭제할 수 없습니다.' });
      return { ok: false };
    }

    let meta = await this.chatService.findRoomByRoomId(room);
    if (!meta) {
      await this.chatService.backfillRoomMetaIfMissing(room);
      meta = await this.chatService.findRoomByRoomId(room);
    }
    if (!meta || meta.ownerId !== me.userId) {
      client.emit('chatError', { message: '방장만 방을 삭제할 수 있습니다.' });
      return { ok: false };
    }

    try {
      await this.chatService.deleteRoomFully(room);
    } catch (e) {
      this.logger.error(`[채팅] 방 메시지 삭제 실패: ${String(e)}`);
      client.emit('chatError', { message: '방 삭제에 실패했습니다.' });
      return { ok: false };
    }

    const sockets = await this.server.in(room).fetchSockets();
    for (const s of sockets) {
      const d = s.data as ClientData;
      void s.leave(room);
      if (d.currentRoom === room) {
        d.currentRoom = undefined;
      }
      s.emit('roomDeleted', { roomId: room });
    }

    this.knownRooms.delete(room);
    this.roomMembers.delete(room);
    this.emitRoomList();
    return { ok: true, roomId: room };
  }

  @SubscribeMessage('sendMessage')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: string; text?: string },
  ) {
    const me = client.data as ClientData;
    if (me?.userId == null) return { ok: false };

    const room = sanitizeRoomId(body?.roomId ?? me.currentRoom);
    if (!me.currentRoom || me.currentRoom !== room) {
      client.emit('chatError', { message: '먼저 방에 참가해 주세요.' });
      return { ok: false };
    }

    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) return { ok: false };
    if (text.length > MAX_MESSAGE_LEN) {
      client.emit('chatError', {
        message: `메시지는 ${MAX_MESSAGE_LEN}자 이하로 보내 주세요.`,
      });
      return { ok: false };
    }

    let authorName = me.name;
    let authorImageUrl: string | null = null;
    try {
      const profile = await this.usersService.getMeProfile(me.userId);
      authorName = profile.name;
      authorImageUrl = profile.imageUrl;
    } catch {
      authorImageUrl = null;
    }

    let saved: ChatMessage;
    try {
      saved = await this.chatService.append(
        room,
        me.userId,
        authorName,
        authorImageUrl,
        text,
      );
    } catch (e) {
      this.logger.error(`[채팅] 저장 실패: ${String(e)}`);
      client.emit('chatError', { message: '메시지 저장에 실패했습니다.' });
      return { ok: false };
    }

    this.knownRooms.add(room);
    const [msg] = toWireMessages([saved]);
    if (!msg) return { ok: false };
    this.server.to(room).emit('chatMessage', msg);
    return { ok: true, id: msg.id };
  }
}
