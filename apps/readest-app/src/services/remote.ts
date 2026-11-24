// A book belongs to exactly one remote (ADR 0010): BookRoom, a file-sync
// backend, an OPDS catalog or this device. Its shelf membership, file,
// progress and notes sync only to that remote, and the library shows one
// remote at a time.

import type { Book, BookRemote } from '@/types/book';
import type { OPDSCatalog } from '@/types/opds';
import type { SystemSettings } from '@/types/settings';
import type { FileSyncBackendKind } from '@/services/sync/file/providerRegistry';
import { useLibraryStore } from '@/store/libraryStore';

type Settings = SystemSettings | null | undefined;
export type OPDSProgressSync = NonNullable<OPDSCatalog['progressSync']>;

const OPDS_PREFIX = 'opds:';
const FILE_SYNC_REMOTES: readonly BookRemote[] = ['webdav', 'gdrive', 's3', 'onedrive', 'icloud'];

/**
 * An OPDS catalog's remote. Keyed by the URL-derived `contentId`, which a
 * replica pull keeps, rather than the local `id`, which it may replace.
 */
export const opdsRemote = (catalog: Pick<OPDSCatalog, 'id' | 'contentId'>): BookRemote =>
  `${OPDS_PREFIX}${catalog.contentId ?? catalog.id}`;

export const bookRemote = (book: Pick<Book, 'remote'>): BookRemote => book.remote ?? 'local';

export const isFileSyncRemote = (remote: BookRemote): remote is FileSyncBackendKind =>
  FILE_SYNC_REMOTES.includes(remote);

const opdsCatalogId = (remote: BookRemote): string | null =>
  remote.startsWith(OPDS_PREFIX) ? remote.slice(OPDS_PREFIX.length) : null;

export const getCurrentRemote = (settings: Settings): BookRemote =>
  settings?.currentRemote ?? 'bookroom';

/**
 * Where a book the user adds lands: the current remote when it takes new
 * books. An OPDS catalog only hands out its own books, so imports made while
 * browsing one stay on this device.
 */
export const importRemote = (settings: Settings): BookRemote => {
  const current = getCurrentRemote(settings);
  return opdsCatalogId(current) ? 'local' : current;
};

export const isOnBookRoom = (book: Pick<Book, 'remote'>): boolean =>
  bookRemote(book) === 'bookroom';

/** The catalog an OPDS book came from, while it is still configured. */
export const catalogOfRemote = (
  settings: Settings,
  remote: BookRemote,
): OPDSCatalog | undefined => {
  const id = opdsCatalogId(remote);
  if (!id) return undefined;
  return settings?.opdsCatalogs?.find(
    (catalog) => (catalog.contentId === id || catalog.id === id) && !catalog.deletedAt,
  );
};

/** The service that syncs an OPDS book's progress and notes, if its catalog has one. */
export const progressSyncOf = (
  settings: Settings,
  book: Pick<Book, 'remote'>,
): OPDSProgressSync | null => catalogOfRemote(settings, bookRemote(book))?.progressSync ?? null;

/** Whether the library book with this hash belongs to BookRoom. */
export const isBookRoomHash = (hash: string): boolean => {
  const book = useLibraryStore.getState().getBookByHash(hash);
  return !!book && isOnBookRoom(book);
};

/** Whether the library book with this hash syncs through `service` (its catalog's choice). */
export const syncsHashVia = (
  settings: Settings,
  hash: string,
  service: OPDSProgressSync,
): boolean => {
  const book = useLibraryStore.getState().getBookByHash(hash);
  return !!book && progressSyncOf(settings, book) === service;
};
