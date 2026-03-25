import { randomUUID } from 'crypto';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { JWT_ACCESS_SECRET, corsOrigin } from '../env.constants';

const MAX_MESSAGE_LEN = 2000;
const MAX_ROOM_ID_LEN = 64;

type ClientData = {
  userId: number;
  name: string;
  currentRoom?: string;
};

export type RoomListEntry = { id: string; members: number };

function sanitizeRoomId(raw: unknown): string {
  if (typeof raw !== 'string') return 'lobby';
  const t = raw.trim().toLowerCase().replace(/\s+/g, '-');
  const safe = t.replace(/[^a-z0-9가-힣._-]/g, '').slice(0, MAX_ROOM_ID_LEN);
  return safe || 'lobby';
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: corsOrigin(),
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  /** 소켓이 방에 들어간 횟수(한 소켓당 방당 1) */
  private readonly roomMembers = new Map<string, number>();
  /** 한 번이라도 생성·사용된 방(빈 방도 목록에 남김) */
  private readonly knownRooms = new Set<string>(['lobby']);

  constructor(private readonly jwt: JwtService) {}

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

  private buildRoomList(): RoomListEntry[] {
    return Array.from(this.knownRooms)
      .map((id) => ({ id, members: this.roomMembers.get(id) ?? 0 }))
      .sort((a, b) => {
        if (a.id === 'lobby') return -1;
        if (b.id === 'lobby') return 1;
        if (b.members !== a.members) return b.members - a.members;
        return a.id.localeCompare(b.id);
      });
  }

  private emitRoomList(): void {
    this.server.emit('roomList', { rooms: this.buildRoomList() });
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
      const data: ClientData = {
        userId: payload.sub,
        name: (payload.name?.trim() || payload.email || 'user').slice(0, 80),
      };
      (client.data as ClientData) = data;
      this.logger.log(`[채팅] 연결 socket=${client.id} userId=${data.userId}`);
      client.emit('roomList', { rooms: this.buildRoomList() });
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
  handleGetRoomList() {
    return { rooms: this.buildRoomList() };
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: string },
  ) {
    const me = client.data as ClientData;
    if (me?.userId == null) return { ok: false };

    const room = sanitizeRoomId(body?.roomId);
    if (me.currentRoom === room) {
      client.emit('joinedRoom', { roomId: room });
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
    client.to(room).emit('systemNotice', {
      type: 'join',
      roomId: room,
      userId: me.userId,
      userName: me.name,
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

  @SubscribeMessage('sendMessage')
  handleSend(
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

    const msg = {
      id: randomUUID(),
      roomId: room,
      userId: me.userId,
      userName: me.name,
      text,
      createdAt: new Date().toISOString(),
    };
    this.server.to(room).emit('chatMessage', msg);
    return { ok: true, id: msg.id };
  }
}
