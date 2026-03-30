import { ArgumentsHost } from '@nestjs/common';
import { CatNotFoundException } from '../exceptions/cat-not-found.exception';
import { CatNotFoundFilter } from './cat-not-found.filter';

describe('CatNotFoundFilter', () => {
  let filter: CatNotFoundFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let res: { status: jest.Mock };

  beforeEach(() => {
    filter = new CatNotFoundFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock };
  });

  it('404 JSON 바디에 error·hint 포함', () => {
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
      }),
    } as unknown as ArgumentsHost;

    const ex = new CatNotFoundException(9);
    filter.catch(ex, host);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledTimes(1);
    type Payload = {
      statusCode: number;
      error: string;
      message: string;
      hint: string;
    };
    const calls = jsonMock.mock.calls as unknown as [Payload][];
    const payload = calls[0][0];
    expect(payload.statusCode).toBe(404);
    expect(payload.error).toBe('CatNotFound');
    expect(payload.message).toContain('9');
    expect(payload.hint).toContain('ExceptionFilter');
  });
});
