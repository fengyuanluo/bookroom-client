import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const gateMock = vi.fn();
vi.mock('@/services/sync/cloudSyncProvider', async (orig) => ({
  ...(await orig<typeof import('@/services/sync/cloudSyncProvider')>()),
  resolveBookSyncGate: (...a: unknown[]) => gateMock(...a),
}));
const createProviderMock = vi.fn();
vi.mock('@/services/sync/file/providerRegistry', () => ({
  createFileSyncProvider: (...a: unknown[]) => createProviderMock(...a),
}));
const getUserIDMock = vi.fn();
vi.mock('@/utils/access', async (orig) => ({
  ...(await orig<typeof import('@/utils/access')>()),
  getUserID: () => getUserIDMock(),
}));

import { getBookDataDestinations } from '@/services/sync/bookData/destinationsFor';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Book } from '@/types/book';
import type { SystemSettings } from '@/types/settings';
import type { AppService } from '@/types/system';

const appService = {} as AppService;
const ids = async () => (await getBookDataDestinations(appService, 'h')).map((d) => d.id);

const setSettings = (patch: Partial<SystemSettings>) =>
  useSettingsStore.setState({ settings: { ...patch } as SystemSettings });
const setBook = (book: Partial<Book> | null) =>
  useLibraryStore.setState({
    library: book ? ([{ hash: 'h', title: 'T', ...book }] as Book[]) : [],
    hashIndex: new Map(book ? [['h', 0]] : []),
  });

beforeEach(() => {
  gateMock.mockReset().mockReturnValue({ readest: false, backends: [] });
  createProviderMock
    .mockReset()
    .mockImplementation(async (kind: string) => ({ rootPath: '/', kind }));
  getUserIDMock.mockReset().mockResolvedValue('u1');
  setSettings({});
  setBook({ uploadedAt: 1, remote: 'bookroom' });
});
afterEach(() => setBook(null));

describe('getBookDataDestinations', () => {
  test('returns every backend the gate allows', async () => {
    gateMock.mockReturnValue({ readest: false, backends: ['webdav', 'gdrive'] });
    expect(await ids()).toEqual(['webdav', 'gdrive']);
  });

  test('skips a backend whose provider cannot be built', async () => {
    gateMock.mockReturnValue({ readest: false, backends: ['webdav', 'gdrive'] });
    createProviderMock.mockImplementation(async (kind: string) =>
      kind === 'webdav' ? null : { rootPath: '/' },
    );
    expect(await ids()).toEqual(['gdrive']);
  });

  test('returns none for a backend book whose remote is not enabled', async () => {
    gateMock.mockReturnValue({ readest: false, backends: [] });
    setBook({ uploadedAt: 1, remote: 'webdav' });
    expect(await ids()).toEqual([]);
    expect(createProviderMock).not.toHaveBeenCalled();
  });

  test('adds Readest Cloud for an uploaded book', async () => {
    gateMock.mockReturnValue({ readest: true, backends: ['webdav'] });
    setSettings({ readestCloud: { enabled: true } } as Partial<SystemSettings>);
    expect(await ids()).toEqual(['readest', 'webdav']);
  });

  test('skips Readest Cloud for a book that is not uploaded', async () => {
    gateMock.mockReturnValue({ readest: true, backends: [] });
    setSettings({ readestCloud: { enabled: true } } as Partial<SystemSettings>);
    setBook({ uploadedAt: null, remote: 'bookroom' });
    expect(await ids()).toEqual([]);
  });

  test('skips Readest Cloud for a book on another remote', async () => {
    gateMock.mockReturnValue({ readest: false, backends: ['webdav'] });
    setSettings({
      readestCloud: { enabled: true },
      webdav: { enabled: true },
    } as Partial<SystemSettings>);
    setBook({ uploadedAt: 1, remote: 'webdav' });
    expect(await ids()).toEqual(['webdav']);
  });

  test('skips Readest Cloud with the Books category off', async () => {
    gateMock.mockReturnValue({ readest: true, backends: [] });
    setSettings({
      readestCloud: { enabled: true },
      syncCategories: { book: false },
    } as Partial<SystemSettings>);
    expect(await ids()).toEqual([]);
  });

  test('skips Readest Cloud when signed out', async () => {
    gateMock.mockReturnValue({ readest: true, backends: [] });
    setSettings({ readestCloud: { enabled: true } } as Partial<SystemSettings>);
    getUserIDMock.mockResolvedValue(null);
    expect(await ids()).toEqual([]);
  });

  test('returns none when Book Data is off', async () => {
    gateMock.mockReturnValue({ readest: true, backends: ['webdav'] });
    setSettings({
      readestCloud: { enabled: true },
      syncCategories: { book_data: false },
    } as Partial<SystemSettings>);
    expect(await ids()).toEqual([]);
    expect(createProviderMock).not.toHaveBeenCalled();
  });
});
