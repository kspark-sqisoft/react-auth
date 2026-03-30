import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ParseCreateCatPipe } from './parse-create-cat.pipe';

const bodyMeta: ArgumentMetadata = {
  type: 'body',
  metatype: undefined,
  data: '',
};

describe('ParseCreateCatPipe', () => {
  let pipe: ParseCreateCatPipe;

  beforeEach(() => {
    pipe = new ParseCreateCatPipe();
  });

  it('올바른 body → CreateCatDto', () => {
    expect(
      pipe.transform({ name: '  나비  ', age: 2, breed: '코리안' }, bodyMeta),
    ).toEqual({ name: '나비', age: 2, breed: '코리안' });
  });

  it('age 생략 시 1, breed 빈 문자열이면 mixed', () => {
    expect(pipe.transform({ name: 'a' }, bodyMeta)).toEqual({
      name: 'a',
      age: 1,
      breed: 'mixed',
    });
  });

  it('null body → BadRequestException', () => {
    expect(() => pipe.transform(null, bodyMeta)).toThrow(BadRequestException);
  });

  it('name 없음 → BadRequestException', () => {
    expect(() => pipe.transform({ name: '' }, bodyMeta)).toThrow(
      BadRequestException,
    );
  });

  it('age 가 범위 밖 → BadRequestException', () => {
    expect(() => pipe.transform({ name: 'x', age: 41 }, bodyMeta)).toThrow(
      BadRequestException,
    );
  });

  it('age 가 소수 → BadRequestException', () => {
    expect(() => pipe.transform({ name: 'x', age: 1.5 }, bodyMeta)).toThrow(
      BadRequestException,
    );
  });
});
