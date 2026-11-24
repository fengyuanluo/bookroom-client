import { getBaseUrl } from '@/services/environment';

export type AnnotationDeepLink = {
  bookHash: string;
  noteId: string;
  cfi?: string;
};

/**
 * Which form of annotation link markdown export embeds: the custom-scheme
 * `readest://` app deeplink or the universal `https://` web link.
 */
export type AnnotationLinkType = 'app' | 'web';

/**
 * Shared readest:// URL parsing: validates the scheme and returns a uniform
 * path-segment list, or null if it doesn't match. Web links point at the
 * BookRoom server's /o page, which opens the app itself.
 */
const parseReadestUrl = (
  url: string,
): { segments: string[]; searchParams: URLSearchParams } | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'readest:') return null;
  // readest:// URLs park their first path segment in `host`, not pathname.
  const segments = [parsed.host, ...parsed.pathname.split('/')].filter(Boolean);
  return { segments, searchParams: parsed.searchParams };
};

/**
 * Build the HTTPS URL for an annotation, used in markdown export and Readwise
 * sync: the /o landing page of the BookRoom server that hosts the web build,
 * which opens the app or continues in the browser. Without a server (signed
 * out of a native build) the custom-scheme link is the only one that works.
 */
export const buildAnnotationWebUrl = (link: AnnotationDeepLink): string => {
  const base = getBaseUrl();
  if (!base) return buildAnnotationAppUrl(link);
  const params = new URLSearchParams({ book: link.bookHash, note: link.noteId });
  if (link.cfi) params.set('cfi', link.cfi);
  return `${base}/o?${params.toString()}`;
};

/**
 * Build the custom-scheme URL. Kept as a parallel form for share-sheet flows
 * and direct deeplink scenarios. Markdown export uses the HTTPS form.
 */
export const buildAnnotationAppUrl = ({ bookHash, noteId, cfi }: AnnotationDeepLink): string => {
  const base = `readest://book/${bookHash}/annotation/${noteId}`;
  return cfi ? `${base}?cfi=${encodeURIComponent(cfi)}` : base;
};

/**
 * Build the annotation link for the requested {@link AnnotationLinkType}.
 * `app` yields the custom-scheme deeplink; `web` yields the universal HTTPS form.
 */
export const buildAnnotationUrl = (
  link: AnnotationDeepLink,
  linkType: AnnotationLinkType,
): string => (linkType === 'app' ? buildAnnotationAppUrl(link) : buildAnnotationWebUrl(link));

/**
 * The /o landing-page link {@link buildAnnotationWebUrl} makes, on whichever
 * BookRoom server issued it.
 */
const parseAnnotationWebUrl = (url: string): AnnotationDeepLink | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (!/\/o\/?$/.test(parsed.pathname)) return null;
  const bookHash = parsed.searchParams.get('book');
  const noteId = parsed.searchParams.get('note');
  if (!bookHash || !noteId) return null;
  return { bookHash, noteId, cfi: parsed.searchParams.get('cfi') || undefined };
};

/**
 * Parse an incoming annotation link: the BookRoom /o web link, or readest://
 * in the hierarchical form (book/{hash}/annotation/{id}) or the legacy flat
 * form (annotation/{hash}/{id}) emitted by older Readwise syncs.
 * Returns null if the URL doesn't match.
 */
export const parseAnnotationDeepLink = (url: string): AnnotationDeepLink | null => {
  const web = parseAnnotationWebUrl(url);
  if (web) return web;
  const parsed = parseReadestUrl(url);
  if (!parsed) return null;
  const { segments, searchParams } = parsed;

  const cfiParam = searchParams.get('cfi');
  const cfi = cfiParam ? cfiParam : undefined;

  // Hierarchical: book/{hash}/annotation/{id}
  if (segments.length === 4 && segments[0] === 'book' && segments[2] === 'annotation') {
    return { bookHash: segments[1]!, noteId: segments[3]!, cfi };
  }

  // Legacy flat: annotation/{hash}/{id}
  if (segments.length === 3 && segments[0] === 'annotation') {
    return { bookHash: segments[1]!, noteId: segments[2]!, cfi };
  }

  return null;
};

/**
 * Parse an incoming readest:// book-open URL.
 * Matches only the bare form `book/{hash}` (the widget tap target); the
 * 4-segment annotation form `book/{hash}/annotation/{id}` is handled by
 * parseAnnotationDeepLink and must NOT match here.
 */
export const parseBookDeepLink = (url: string): { bookHash: string; autoplay?: boolean } | null => {
  const parsed = parseReadestUrl(url);
  if (!parsed) return null;
  const { segments, searchParams } = parsed;

  if (segments.length === 2 && segments[0] === 'book' && segments[1]) {
    // `?autoplay=tts` is appended by the Android Auto cold-resume launch to ask
    // the reader to start read-aloud once the book is open. Only surface the
    // flag when set so the common shape stays `{ bookHash }`.
    if (searchParams.get('autoplay') === 'tts') {
      return { bookHash: segments[1], autoplay: true };
    }
    return { bookHash: segments[1] };
  }
  return null;
};

/**
 * Parse an incoming `readest://widget-group/{groupBy}/{groupId}` deep link (a
 * "browse groups" tile tap), where `groupId` is the group's Library id.
 */
export const parseWidgetGroupDeepLink = (
  url: string,
): { groupBy: string; groupId: string } | null => {
  const parsed = parseReadestUrl(url);
  if (!parsed) return null;
  const { segments } = parsed;
  if (segments.length === 3 && segments[0] === 'widget-group' && segments[1] && segments[2]) {
    try {
      return { groupBy: segments[1], groupId: decodeURIComponent(segments[2]) };
    } catch {
      // Malformed percent-encoding: reject the link like any other bad input.
      return null;
    }
  }
  return null;
};

/**
 * Parse an incoming `readest://widget-edit-shelf/{shelfId}` deep link (the
 * configure dialog's "Edit bookshelf" button), where `shelfId` is the
 * currently-selected shelf's id.
 */
export const parseWidgetEditShelfDeepLink = (url: string): { shelfId: string } | null => {
  const parsed = parseReadestUrl(url);
  if (!parsed) return null;
  const { segments } = parsed;
  if (segments.length === 2 && segments[0] === 'widget-edit-shelf' && segments[1]) {
    try {
      return { shelfId: decodeURIComponent(segments[1]) };
    } catch {
      // Malformed percent-encoding: reject the link like any other bad input.
      return null;
    }
  }
  return null;
};
