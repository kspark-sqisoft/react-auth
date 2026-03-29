import {
  postContentPlainLength,
  sanitizePostContentHtml,
} from './post-content-sanitize';

describe('sanitizePostContentHtml', () => {
  it('script 태그 제거', () => {
    const out = sanitizePostContentHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).not.toContain('script');
    expect(out).toContain('hi');
  });

  it('허용 태그·링크 유지', () => {
    const out = sanitizePostContentHtml(
      '<p><a href="https://example.com">x</a></p>',
    );
    expect(out).toContain('https://example.com');
    expect(out).toContain('noopener');
  });
});

describe('postContentPlainLength', () => {
  it('태그 제거 후 글자만 계산', () => {
    expect(postContentPlainLength('<p>a b</p>')).toBe(3);
  });

  it('빈 본문', () => {
    expect(postContentPlainLength('<p></p>')).toBe(0);
  });
});
