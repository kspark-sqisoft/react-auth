import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatMessage } from './chat-message.entity';
import { ChatRoom } from './chat-room.entity';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let msgRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
    delete: jest.Mock;
  };
  let roomRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    msgRepo = {
      create: jest.fn((x: object) => x),
      save: jest.fn((x: ChatMessage) =>
        Promise.resolve({ ...x, id: 1 } as ChatMessage),
      ),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      delete: jest.fn(),
    };
    roomRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x: object) => x),
      find: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(ChatMessage), useValue: msgRepo },
        { provide: getRepositoryToken(ChatRoom), useValue: roomRepo },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  describe('append', () => {
    it('authorName 80자로 자름', async () => {
      const long = 'x'.repeat(100);
      await service.append('lobby', 1, long, null, 'hello');
      expect(msgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorName: 'x'.repeat(80),
          body: 'hello',
        }),
      );
    });
  });

  describe('ensureRoomRecord', () => {
    it('이미 방 있으면 아무 것도 안 함', async () => {
      roomRepo.findOne.mockResolvedValue({ roomId: 'r1', ownerId: 1 });
      await service.ensureRoomRecord('r1', 2, 'b');
      expect(roomRepo.save).not.toHaveBeenCalled();
    });

    it('방 없고 메시지 없으면 후보를 방장으로 저장', async () => {
      roomRepo.findOne.mockResolvedValue(null);
      msgRepo.findOne.mockResolvedValue(null);
      roomRepo.create.mockReturnValue({ roomId: 'new', ownerId: 9 });
      await service.ensureRoomRecord('new', 9, '나');
      expect(roomRepo.save).toHaveBeenCalled();
    });

    it('방 없고 가장 오래된 메시지 있으면 그 작성자를 방장으로', async () => {
      roomRepo.findOne.mockResolvedValue(null);
      msgRepo.findOne.mockResolvedValue({
        authorId: 3,
        authorName: 'first',
      } as ChatMessage);
      roomRepo.create.mockReturnValue({});
      await service.ensureRoomRecord('r2', 9, '나');
      expect(roomRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'r2',
          ownerId: 3,
          ownerName: 'first',
        }),
      );
      expect(roomRepo.save).toHaveBeenCalled();
    });
  });

  describe('findRecent', () => {
    it('DESC 조회 후 reverse로 시간 오름차순', async () => {
      const a = { id: 1, body: 'a' } as ChatMessage;
      const b = { id: 2, body: 'b' } as ChatMessage;
      msgRepo.find.mockResolvedValue([b, a]);
      const out = await service.findRecent('lobby', 10);
      expect(out).toEqual([a, b]);
      expect(msgRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId: 'lobby' },
          order: { createdAt: 'DESC' },
          take: 10,
        }),
      );
    });
  });
});
