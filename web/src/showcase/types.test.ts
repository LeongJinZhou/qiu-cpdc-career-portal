import { describe, expect, it } from 'vitest';
import { parseTags } from './types';

describe('parseTags', () => {
  it('splits on commas, trims and drops repeats ignoring case', () => {
    expect(parseTags(' Python, react  native ,python,, SQL ')).toEqual(['Python', 'react native', 'SQL']);
  });

  it('keeps at most 12 tags of 40 characters', () => {
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join(',');
    expect(parseTags(many)).toHaveLength(12);
    expect(parseTags('x'.repeat(50))[0]).toHaveLength(40);
  });
});
