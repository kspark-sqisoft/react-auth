import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { CatsParseIntIdPipe } from './cats-parse-int-id.pipe';

const paramMeta: ArgumentMetadata = {
  type: 'param',
  metatype: Number,
  data: 'id',
};

describe('CatsParseIntIdPipe', () => {
  let pipe: CatsParseIntIdPipe;

  beforeEach(() => {
    pipe = new CatsParseIntIdPipe();
  });

  it('숫자 문자열 → number', async () => {
    await expect(pipe.transform('42', paramMeta)).resolves.toBe(42);
  });

  it('비숫자 → BadRequestException', async () => {
    await expect(pipe.transform('abc', paramMeta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
