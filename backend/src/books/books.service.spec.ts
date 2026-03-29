import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookPage } from './book-page.entity';
import { Book } from './book.entity';
import { BooksService } from './books.service';

describe('BooksService', () => {
  let service: BooksService;
  let bookRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let pageRepo: { save: jest.Mock; create: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    bookRepo = {
      create: jest.fn((x: object) => x),
      save: jest.fn((b: Book & { id?: number }) => {
        Object.assign(b, { id: 5 });
        return Promise.resolve(b);
      }),
      findOne: jest.fn(),
    };
    pageRepo = {
      create: jest.fn((x: object) => x),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: getRepositoryToken(Book), useValue: bookRepo },
        { provide: getRepositoryToken(BookPage), useValue: pageRepo },
      ],
    }).compile();

    service = module.get(BooksService);
  });

  describe('create', () => {
    it('제목 없으면 BadRequestException', async () => {
      await expect(service.create(1, { title: '  ' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(bookRepo.save).not.toHaveBeenCalled();
    });

    it('슬라이드 너비가 너무 작으면 BadRequestException', async () => {
      await expect(
        service.create(1, { title: 'ok', slideWidth: 50 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('성공 시 기본 페이지 1장 저장 후 findOne 호출', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 5,
        title: 'ok',
        slideWidth: 960,
        slideHeight: 540,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { id: 1, name: 'U', imageUrl: null },
        pages: [],
      });

      const out = await service.create(1, { title: 'ok' });
      expect(out.title).toBe('ok');
      expect(bookRepo.save).toHaveBeenCalled();
      expect(pageRepo.save).toHaveBeenCalled();
    });
  });
});
