import { createHash } from 'crypto';
import { hashRefreshToken } from './refresh-token-hash';

describe('hashRefreshToken', () => {
  it('동일 입력이면 항상 같은 sha256 hex', () => {
    const raw = 'test-refresh-token';
    expect(hashRefreshToken(raw)).toBe(
      createHash('sha256').update(raw, 'utf8').digest('hex'),
    );
  });

  it('다른 입력이면 다른 해시', () => {
    expect(hashRefreshToken('a')).not.toBe(hashRefreshToken('b'));
  });
});
