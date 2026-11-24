import type { Book } from '@/types/book';
import type { SystemSettings } from '@/types/settings';
import type { FileSyncBackendKind } from '@/services/sync/file/providerRegistry';
import { bookRemote, isOnBookRoom } from '@/services/remote';

/**
 * The cloud sync provider kind for library data (book files, book rows,
 * progress, notes). 'readest' is BookRoom, which speaks the Readest cloud
 * protocol; the others are the third-party file-sync backends.
 *
 * Any subset of providers may be enabled, but each book syncs only to the
 * remote it belongs to (ADR 0010, `resolveBookSyncGate`). Account-level data
 * (settings replicas, reading stats, dictionaries/fonts, translations) always
 * syncs via BookRoom while signed in.
 */
export type CloudSyncProviderKind = 'readest' | FileSyncBackendKind;

/** Settings slice key for a third-party backend kind. */
export const settingsKeyForBackend = (
  kind: FileSyncBackendKind,
): 'webdav' | 'googleDrive' | 's3' | 'onedrive' | 'icloud' =>
  kind === 'gdrive' ? 'googleDrive' : kind;

/** Human-readable provider name (product names — deliberately untranslated). */
export const cloudProviderDisplayName = (kind: CloudSyncProviderKind): string =>
  kind === 'gdrive'
    ? 'Google Drive'
    : kind === 'webdav'
      ? 'WebDAV'
      : kind === 's3'
        ? 'S3'
        : kind === 'onedrive'
          ? 'OneDrive'
          : kind === 'icloud'
            ? 'iCloud'
            : 'Readest Cloud';

/**
 * The third-party backends the user has switched on, in a STABLE order that
 * every loop, list, and sync pass in the app relies on.
 */
export const getActiveFileSyncBackends = (
  settings: SystemSettings | null | undefined,
): FileSyncBackendKind[] => {
  const enabled: FileSyncBackendKind[] = [];
  if (settings?.webdav?.enabled) enabled.push('webdav');
  if (settings?.googleDrive?.enabled) enabled.push('gdrive');
  if (settings?.s3?.enabled) enabled.push('s3');
  if (settings?.onedrive?.enabled) enabled.push('onedrive');
  if (settings?.icloud?.enabled) enabled.push('icloud');
  return enabled;
};

/**
 * Whether BookRoom syncs the library channels on this device. On unless the
 * user unticks it: books belong to one remote each (ADR 0010), so enabling a
 * file-sync backend no longer takes the library away from BookRoom.
 */
export const isReadestCloudEnabled = (settings: SystemSettings | null | undefined): boolean =>
  settings?.readestCloud?.enabled ?? true;

/** Every provider syncing the library on this device, Readest Cloud first. */
export const getCloudSyncProviders = (
  settings: SystemSettings | null | undefined,
): CloudSyncProviderKind[] => [
  ...(isReadestCloudEnabled(settings) ? (['readest'] as const) : []),
  ...getActiveFileSyncBackends(settings),
];

/** Comma-joined product names, for the "Synced via {{provider}}" copy. */
export const cloudProvidersDisplayName = (kinds: CloudSyncProviderKind[]): string =>
  kinds.map(cloudProviderDisplayName).join(', ');

export interface CloudSyncGate {
  /** Readest Cloud syncs the library channels (rows, progress, notes, files). */
  readest: boolean;
  /** Third-party backends the user switched on, in the fixed webdav/gdrive/s3/onedrive/icloud order. */
  backends: FileSyncBackendKind[];
}

export const resolveCloudSyncGate = (
  settings: SystemSettings | null | undefined,
): CloudSyncGate => ({
  readest: isReadestCloudEnabled(settings),
  backends: getActiveFileSyncBackends(settings),
});

/**
 * The providers that may carry this book's row, file, progress and notes: only
 * the remote it belongs to, and only while that remote is enabled here.
 */
export const resolveBookSyncGate = (
  settings: SystemSettings | null | undefined,
  book: Pick<Book, 'remote'>,
): CloudSyncGate => ({
  readest: isReadestCloudEnabled(settings) && isOnBookRoom(book),
  backends: getActiveFileSyncBackends(settings).filter((kind) => kind === bookRemote(book)),
});

/** Whether BookRoom storage and rows carry this book. */
export const syncsBookToBookRoom = (
  settings: SystemSettings | null | undefined,
  book: Pick<Book, 'remote'>,
): boolean => resolveBookSyncGate(settings, book).readest;

/** Whether the remote this book belongs to can hold its file right now. */
export const hasBookSyncTarget = (
  settings: SystemSettings | null | undefined,
  book: Pick<Book, 'remote'>,
): boolean => {
  const gate = resolveBookSyncGate(settings, book);
  return gate.readest || gate.backends.length > 0;
};

/**
 * One-time upgrade migration helper (appService migrate20260706): users
 * who already had WebDAV/Drive enabled before provider selection shipped
 * become "third-party selected" on upgrade, which gates native Readest
 * Cloud uploads off — with syncBooks at its old `false` default their
 * books would back up nowhere. Flip syncBooks on for every enabled backend.
 * Mutates `settings` in place (the migration runner saves the same
 * snapshot afterwards) and returns whether anything changed.
 */
export const applySyncBooksAutoEnable = (settings: SystemSettings): boolean => {
  let changed = false;
  for (const kind of getActiveFileSyncBackends(settings)) {
    // A switch (rather than a generically-keyed write) keeps each branch's
    // settings slice type intact; `settings[key] = { ...slice, syncBooks }`
    // does not typecheck when `key` is a union of literal keys.
    switch (kind) {
      case 'webdav':
        if (settings.webdav && !settings.webdav.syncBooks) {
          settings.webdav = { ...settings.webdav, syncBooks: true };
          changed = true;
        }
        break;
      case 'gdrive':
        if (settings.googleDrive && !settings.googleDrive.syncBooks) {
          settings.googleDrive = { ...settings.googleDrive, syncBooks: true };
          changed = true;
        }
        break;
      case 's3':
        if (settings.s3 && !settings.s3.syncBooks) {
          settings.s3 = { ...settings.s3, syncBooks: true };
          changed = true;
        }
        break;
      case 'onedrive':
        if (settings.onedrive && !settings.onedrive.syncBooks) {
          settings.onedrive = { ...settings.onedrive, syncBooks: true };
          changed = true;
        }
        break;
      case 'icloud':
        if (settings.icloud && !settings.icloud.syncBooks) {
          settings.icloud = { ...settings.icloud, syncBooks: true };
          changed = true;
        }
        break;
    }
  }
  return changed;
};
