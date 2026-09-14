import { describe, expect, it } from 'vitest';
import { isAbsoluteUrl, joinUrl } from './url-join';

describe('joinUrl', () => {
  it('joins a base and a relative segment with exactly one slash', () => {
    expect(joinUrl('/api', 'posts')).toBe('/api/posts');
  });

  it('avoids duplicate slashes when both sides have one', () => {
    expect(joinUrl('/api/', '/posts')).toBe('/api/posts');
  });

  it('avoids missing slashes when neither side has one', () => {
    expect(joinUrl('https://api.example.com/v1', 'posts')).toBe('https://api.example.com/v1/posts');
  });

  it('does not prefix an absolute segment with the base', () => {
    expect(joinUrl('https://api.example.com/v1', 'https://other.example.com/x')).toBe(
      'https://other.example.com/x',
    );
  });

  it('treats protocol-relative URLs as absolute', () => {
    expect(joinUrl('https://api.example.com', '//cdn.example.com/x')).toBe('//cdn.example.com/x');
  });

  it('handles an empty base', () => {
    expect(joinUrl('', 'posts')).toBe('/posts');
  });
});

describe('isAbsoluteUrl', () => {
  it('recognizes http(s) URLs', () => {
    expect(isAbsoluteUrl('https://example.com')).toBe(true);
    expect(isAbsoluteUrl('http://example.com')).toBe(true);
  });

  it('recognizes protocol-relative URLs', () => {
    expect(isAbsoluteUrl('//example.com')).toBe(true);
  });

  it('treats relative paths as non-absolute', () => {
    expect(isAbsoluteUrl('posts')).toBe(false);
    expect(isAbsoluteUrl('/posts')).toBe(false);
  });
});
