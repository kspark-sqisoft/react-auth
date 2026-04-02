import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Cat } from './cat.entity';
import { CatsService, type CatPublic } from './cats.service';
import { CatNotFoundException } from './exceptions/cat-not-found.exception';

describe('CatsService', () => {
  let service: CatsService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const sampleCatEntity: Cat = {
    id: 1,
    name: '나비',
    age: 2,
    breed: 'mixed',
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
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([sampleCatEntity]),
      findOne: jest.fn(),
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
      expect(repo.find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
      expect(rows).toEqual([sampleCatPublic]);
    });
  });

  describe('findOne', () => {
    it('존재하면 Cat 반환', async () => {
      repo.findOne.mockResolvedValue(sampleCatEntity);
      await expect(service.findOne(1)).resolves.toEqual(sampleCatPublic);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
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
      const out = await service.create({
        name: '모찌',
        age: 3,
        breed: '페르시안',
      });
      expect(repo.create).toHaveBeenCalledWith({
        name: '모찌',
        age: 3,
        breed: '페르시안',
        imageFilename: null,
      });
      expect(repo.save).toHaveBeenCalled();
      expect(out.id).toBe(7);
      expect(out.name).toBe('모찌');
    });

    it('age 생략 시 기본 1, breed 생략 시 mixed', async () => {
      await service.create({ name: '만두' });
      expect(repo.create).toHaveBeenCalledWith({
        name: '만두',
        age: 1,
        breed: 'mixed',
        imageFilename: null,
      });
    });
  });

  describe('remove', () => {
    it('findOne 으로 존재 확인 후 delete 호출', async () => {
      repo.findOne.mockResolvedValue(sampleCatEntity);
      await service.remove(1);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(repo.delete).toHaveBeenCalledWith(1);
    });

    it('없으면 findOne 단계에서 CatNotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toBeInstanceOf(
        CatNotFoundException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
