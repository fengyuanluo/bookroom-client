import { describe, expect, it } from 'vitest';
import {
  getDisplayedTimeRemaining,
  getTimeRemainingMinutes,
  formatTimeLeft,
} from '@/app/library/utils/libraryUtils';
import type { Book } from '@/types/book';
import type { TranslationFunc } from '@/hooks/useTranslation';

const book = (over: Partial<Book>): Book =>
  ({ hash: 'h', title: 'T', author: 'A', format: 'EPUB', ...over }) as Book;

const _: TranslationFunc = (key, options) =>
  key.replace(/{{(\w+)}}/g, (_match, name) => String(options?.[name] ?? ''));

describe('getTimeRemainingMinutes', () => {
  it('converts remaining pages at the reading pace for an ebook', () => {
    // 100 pages left at 60s/page is 100 minutes.
    expect(getTimeRemainingMinutes(book({ progress: [100, 200] as [number, number] }), 60)).toBe(
      100,
    );
  });
});

describe('getDisplayedTimeRemaining', () => {
  it('keeps hiding a time for books that render a status badge instead', () => {
    const base = { progress: [10, 110] as [number, number] };

    expect(getDisplayedTimeRemaining(book({ ...base, readingStatus: 'finished' }))).toBeUndefined();
    expect(getDisplayedTimeRemaining(book({ ...base, readingStatus: 'unread' }))).toBeUndefined();
    expect(getDisplayedTimeRemaining(book({ ...base }))).toBeGreaterThan(0);
  });
});

describe('formatTimeLeft (library tile)', () => {
  it.each([
    [45, '45m left'],
    [96, '1.6h left'],
    [630, '11h left'],
  ])('formats %i minutes as "%s"', (minutes, label) => {
    expect(formatTimeLeft(minutes, _)).toBe(label);
  });
});
