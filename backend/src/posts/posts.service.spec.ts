import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PostAttachment } from './post-attachment.entity';
import { PostLike } from './post-like.entity';
import { Post } from './post.entity';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let attRepo: { create: jest.Mock; save: jest.Mock };
  let likeRepo: { count: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x: object) => x),
      save: jest.fn((p: Post & { id?: number }) => {
        Object.assign(p, { id: 10 });
        return Promise.resolve(p);
      }),
      findOneOrFail: jest.fn(),
    };
    attRepo = {
      create: jest.fn((x: object) => x),
      save: jest.fn(),
    };
    likeRepo = {
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(Post), useValue: repo },
        { provide: getRepositoryToken(PostAttachment), useValue: attRepo },
        { provide: getRepositoryToken(PostLike), useValue: likeRepo },
      ],
    }).compile();

    service = module.get(PostsService);
  });

  describe('createWithAttachments', () => {
    it('제목 없으면 BadRequestException', async () => {
      await expect(
        service.createWithAttachments(1, '  ', '<p>x</p>', undefined, [], []),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('본문이 비어 있으면 BadRequestException', async () => {
      await expect(
        service.createWithAttachments(1, '제목', '', undefined, [], []),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('본문이 태그만 있으면 BadRequestException', async () => {
      await expect(
        service.createWithAttachments(1, '제목', '<p></p>', undefined, [], []),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('첨부 없이 성공 시 글 저장·조회', async () => {
      const author = {
        id: 1,
        name: 'A',
        profileImageFilename: null as string | null,
      };
      repo.findOneOrFail = jest.fn().mockResolvedValue({
        id: 10,
        title: '제목',
        content: '<p>hello</p>',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date(),
        author,
        attachments: [],
      });

      const out = await service.createWithAttachments(
        1,
        '제목',
        '<p>hello</p>',
        undefined,
        [],
        [],
      );

      expect(out.id).toBe(10);
      expect(out.title).toBe('제목');
      expect(out.category).toBe('general');
      expect(repo.save).toHaveBeenCalled();
      expect(attRepo.save).not.toHaveBeenCalled();
    });
  });
});
