import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from './post.entity';
import { PostComment } from './post-comment.entity';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let commentRepo: { exist: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let postRepo: { exist: jest.Mock };

  beforeEach(async () => {
    commentRepo = {
      exist: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    postRepo = { exist: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(PostComment), useValue: commentRepo },
        { provide: getRepositoryToken(Post), useValue: postRepo },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  describe('create', () => {
    it('글이 없으면 NotFoundException', async () => {
      postRepo.exist.mockResolvedValue(false);
      await expect(
        service.create(1, 1, { content: 'c' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('내용 비어 있으면 BadRequestException', async () => {
      postRepo.exist.mockResolvedValue(true);
      await expect(
        service.create(1, 1, { content: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findTreeByPostId', () => {
    it('글이 없으면 NotFoundException', async () => {
      postRepo.exist.mockResolvedValue(false);
      await expect(service.findTreeByPostId(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
