import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { resolveBookSyncGate } from '@/services/sync/cloudSyncProvider';
import { createFileSyncProvider } from '@/services/sync/file/providerRegistry';
import { isSyncCategoryEnabled } from '@/services/sync/syncCategories';
import { getUserID } from '@/utils/access';
import type { AppService } from '@/types/system';
import { createReadestCloudDestination } from './cloudDestination';
import { createFileSyncDestination } from './fileSyncDestination';
import type { BookDataDestination } from './types';

/**
 * Where a book's data syncs right now: the remote the book belongs to (ADR
 * 0010) — its file-sync backend, or BookRoom when Books sync runs and the book
 * is uploaded there. Empty with the Book Data category off, and for books of
 * any other remote.
 */
export const getBookDataDestinations = async (
  appService: AppService,
  bookHash: string,
): Promise<BookDataDestination[]> => {
  if (!isSyncCategoryEnabled('book_data')) return [];
  const book = useLibraryStore.getState().getBookByHash(bookHash);
  if (!book) return [];
  const settings = useSettingsStore.getState().settings;
  const gate = resolveBookSyncGate(settings, book);
  const destinations: BookDataDestination[] = [];

  if (gate.readest && isSyncCategoryEnabled('book') && book.uploadedAt && (await getUserID())) {
    destinations.push(createReadestCloudDestination(appService));
  }
  for (const backend of gate.backends) {
    const provider = await createFileSyncProvider(backend, settings).catch(() => null);
    if (provider) destinations.push(createFileSyncDestination(backend, provider));
  }
  return destinations;
};
