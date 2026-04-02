import { Test, TestingModule } from '@nestjs/testing';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';
import type { CatsClientSnapshot } from './decorators/cats-client-meta.decorator';

describe('CatsController', () => {
  let controller: CatsController;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };

  const meta: CatsClientSnapshot = {
    ip: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([{ id: 1, name: 'a' }]),
      findOne: jest.fn(),
      create: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatsController],
      providers: [{ provide: CatsService, useValue: service }],
    }).compile();

    controller = module.get(CatsController);
  });

  describe('findAll', () => {
    it('cats 와 _study.decoratorCatsClientMeta 형태로 반환', async () => {
      const out = await controller.findAll(meta);
      expect(service.findAll).toHaveBeenCalled();
      expect(out.cats).toEqual([{ id: 1, name: 'a' }]);
      expect(out._study.decoratorCatsClientMeta).toEqual(meta);
    });
  });

  describe('studyGuardSample', () => {
    it('Guard 통과를 가정한 응답 형태', async () => {
      const out = await controller.studyGuardSample();
      expect(out.ok).toBe(true);
      expect(out.hint).toContain('REQUEST_FLOW');
    });
  });

  describe('findOne', () => {
    it('id 로 서비스 위임', async () => {
      service.findOne.mockResolvedValue({ id: 2, name: 'b' });
      await expect(controller.findOne(2)).resolves.toEqual({
        id: 2,
        name: 'b',
      });
      expect(service.findOne).toHaveBeenCalledWith(2);
    });
  });

  describe('create', () => {
    it('DTO 로 서비스 create 위임', async () => {
      const dto = { name: 'c', age: 1, breed: 'mixed' };
      service.create.mockResolvedValue({ id: 3, ...dto });
      await expect(controller.create(dto)).resolves.toMatchObject({
        id: 3,
        name: 'c',
      });
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('remove', () => {
    it('삭제 후 deletedId 반환', async () => {
      const out = await controller.remove(5);
      expect(service.remove).toHaveBeenCalledWith(5);
      expect(out).toEqual({ deletedId: 5 });
    });
  });
});
