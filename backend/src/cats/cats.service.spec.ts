import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole } from '../users/user-role';
import { Cat } from './cat.entity';
import { CatsService, type CatPublic } from './cats.service';
import { CatNotFoundException } from './exceptions/cat-not-found.exception';

describe('CatsService', () => {
  let service: CatsService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const sampleCatEntity: Cat = {
    id: 1,
    name: '나비',
    age: 2,
    breed: 'mixed',
    owner: { id: 1 } as Cat['owner'],
    imageFilename: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const sampleCatPublic: CatPublic = {
    id: 1,
    name: '나비',
    age: 2,
    breed: 'mixed',
    imageUrl: null,
    ownerId: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([sampleCatEntity]),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn((x: object) => x),
      save: jest.fn((row: Cat) => Promise.resolve({ ...row, id: 7 } as Cat)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatsService,
        { provide: getRepositoryToken(Cat), useValue: repo },
      ],
    }).compile();

    service = module.get(CatsService);
  });

  describe('findAll', () => {
    it('Repository.find 를 id ASC 로 호출하고 결과를 반환', async () => {
      const rows = await service.findAll();
      expect(repo.find).toHaveBeenCalledWith({
        order: { id: 'ASC' },
        relations: ['owner'],
      });
      expect(rows).toEqual([sampleCatPublic]);
    });
  });

  describe('findOne', () => {
    it('존재하면 Cat 반환', async () => {
      repo.findOne.mockResolvedValue(sampleCatEntity);
      await expect(service.findOne(1)).resolves.toEqual(sampleCatPublic);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['owner'],
      });
    });

    it('없으면 CatNotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toBeInstanceOf(
        CatNotFoundException,
      );
    });
  });

  describe('create', () => {
    it('create + save 호출 후 저장된 엔티티 반환', async () => {
      repo.findOneOrFail.mockResolvedValue({
        ...sampleCatEntity,
        id: 7,
        name: '모찌',
        age: 3,
        breed: '페르시안',
        owner: { id: 99 } as Cat['owner'],
      });
      const out = await service.create(
        {
          name: '모찌',
          age: 3,
          breed: '페르시안',
        },
        99,
      );
      expect(repo.create).toHaveBeenCalledWith({
        name: '모찌',
        age: 3,
        breed: '페르시안',
        imageFilename: null,
        owner: { id: 99 },
      });
      expect(repo.save).toHaveBeenCalled();
      expect(repo.findOneOrFail).toHaveBeenCalled();
      expect(out.id).toBe(7);
      expect(out.name).toBe('모찌');
    });

    it('age 생략 시 기본 1, breed 생략 시 mixed', async () => {
      repo.findOneOrFail.mockResolvedValue({
        ...sampleCatEntity,
        id: 7,
        name: '만두',
        owner: { id: 1 } as Cat['owner'],
      });
      await service.create({ name: '만두' }, 1);
      expect(repo.create).toHaveBeenCalledWith({
        name: '만두',
        age: 1,
        breed: 'mixed',
        imageFilename: null,
        owner: { id: 1 },
      });
    });
  });

  describe('remove', () => {
    const ownerActor = { id: 1, role: UserRole.User };

    it('findOne 으로 존재 확인 후 delete 호출', async () => {
      repo.findOne.mockResolvedValue(sampleCatEntity);
      await service.remove(1, ownerActor);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['owner'],
      });
      expect(repo.delete).toHaveBeenCalledWith(1);
    });

    it('소유자가 아니면 ForbiddenException', async () => {
      repo.findOne.mockResolvedValue(sampleCatEntity);
      await expect(
        service.remove(1, { id: 2, role: UserRole.User }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('없으면 findOne 단계에서 CatNotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999, ownerActor)).rejects.toBeInstanceOf(
        CatNotFoundException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
