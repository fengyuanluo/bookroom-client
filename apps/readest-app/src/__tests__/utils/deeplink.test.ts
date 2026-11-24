import { describe, it, expect, vi } from 'vitest';
import {
  buildAnnotationUrl,
  parseWidgetEditShelfDeepLink,
  parseWidgetGroupDeepLink,
} from '../../utils/deeplink';

vi.mock('@/services/environment', () => ({
  getBaseUrl: () => 'https://bookroom.example',
}));

describe('buildAnnotationUrl', () => {
  const link = { bookHash: 'abc', noteId: 'n1', cfi: '/6/4!/4/2' };

  it('builds the custom-scheme app URL when linkType is "app"', () => {
    const url = buildAnnotationUrl(link, 'app');
    expect(url.startsWith('readest://book/abc/annotation/n1')).toBe(true);
  });

  it('builds the HTTPS web URL when linkType is "web"', () => {
    const url = buildAnnotationUrl(link, 'web');
    expect(url.startsWith('https://')).toBe(true);
    expect(url).toBe('https://bookroom.example/o?book=abc&note=n1&cfi=%2F6%2F4%21%2F4%2F2');
  });

  it('preserves the cfi query for both link types', () => {
    const encoded = encodeURIComponent(link.cfi);
    expect(buildAnnotationUrl(link, 'app')).toContain(`cfi=${encoded}`);
    // URLSearchParams percent-encodes `!` where encodeURIComponent does not, so
    // compare the decoded value rather than the serialized string.
    expect(new URL(buildAnnotationUrl(link, 'web')).searchParams.get('cfi')).toBe(link.cfi);
  });

  it('omits the cfi query when no cfi is provided', () => {
    const url = buildAnnotationUrl({ bookHash: 'abc', noteId: 'n1' }, 'app');
    expect(url).toBe('readest://book/abc/annotation/n1');
  });
});

describe('widget group deep link', () => {
  it('parses a group link into its axis and decoded group id', () => {
    expect(parseWidgetGroupDeepLink('readest://widget-group/series/a1b2%20c3')).toEqual({
      groupBy: 'series',
      groupId: 'a1b2 c3',
    });
    expect(parseWidgetGroupDeepLink('readest://widget-group/series')).toBeNull();
    // Malformed percent-encoding is rejected, not thrown.
    expect(parseWidgetGroupDeepLink('readest://widget-group/series/a%')).toBeNull();
  });

  it('only accepts the readest:// scheme, never the web host', () => {
    expect(parseWidgetGroupDeepLink('https://web.readest.com/o/widget-group/series/x')).toBeNull();
  });
});

describe('widget edit-shelf deep link', () => {
  it('parses the decoded shelf id', () => {
    expect(parseWidgetEditShelfDeepLink('readest://widget-edit-shelf/a1b2%20c3')).toEqual({
      shelfId: 'a1b2 c3',
    });
    expect(parseWidgetEditShelfDeepLink('readest://widget-edit-shelf/')).toBeNull();
    // Malformed percent-encoding is rejected, not thrown.
    expect(parseWidgetEditShelfDeepLink('readest://widget-edit-shelf/a%')).toBeNull();
  });

  it('only accepts the readest:// scheme, never the web host', () => {
    expect(
      parseWidgetEditShelfDeepLink('https://web.readest.com/o/widget-edit-shelf/x'),
    ).toBeNull();
  });
});
