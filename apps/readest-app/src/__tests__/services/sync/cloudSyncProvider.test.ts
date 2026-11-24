import { describe, test, expect } from 'vitest';
import type { SystemSettings } from '@/types/settings';

import {
  applySyncBooksAutoEnable,
  cloudProviderDisplayName,
  cloudProvidersDisplayName,
  getActiveFileSyncBackends,
  getCloudSyncProviders,
  hasBookSyncTarget,
  isReadestCloudEnabled,
  resolveBookSyncGate,
  resolveCloudSyncGate,
  settingsKeyForBackend,
  syncsBookToBookRoom,
} from '@/services/sync/cloudSyncProvider';

const makeSettings = (overrides: Partial<SystemSettings> = {}): SystemSettings =>
  ({
    webdav: { enabled: false },
    googleDrive: { enabled: false },
    ...overrides,
  }) as SystemSettings;

const s = (partial: Partial<SystemSettings>): SystemSettings => partial as SystemSettings;

describe('resolveCloudSyncGate', () => {
  test('Readest Cloud is on by default and no backend is enabled', () => {
    expect(resolveCloudSyncGate(makeSettings())).toEqual({
      readest: true,
      backends: [],
    });
  });

  test('reports every enabled backend alongside Readest Cloud', () => {
    const settings = makeSettings({
      readestCloud: { enabled: true },
      googleDrive: { enabled: true } as never,
      webdav: { enabled: true } as never,
    });
    expect(resolveCloudSyncGate(settings)).toEqual({
      readest: true,
      backends: ['webdav', 'gdrive'],
    });
  });

  test('Readest Cloud can be switched off while a backend stays on', () => {
    const settings = makeSettings({
      readestCloud: { enabled: false },
      webdav: { enabled: true } as never,
    });
    expect(resolveCloudSyncGate(settings)).toEqual({
      readest: false,
      backends: ['webdav'],
    });
  });
});

describe('resolveBookSyncGate (one remote per book, ADR 0010)', () => {
  test('a BookRoom book syncs only through Readest Cloud', () => {
    const settings = makeSettings({
      readestCloud: { enabled: true },
      webdav: { enabled: true } as never,
    });
    expect(resolveBookSyncGate(settings, { remote: 'bookroom' })).toEqual({
      readest: true,
      backends: [],
    });
  });

  test('a file-sync book syncs only through the backend it belongs to', () => {
    const settings = makeSettings({
      readestCloud: { enabled: true },
      googleDrive: { enabled: true } as never,
      webdav: { enabled: true } as never,
    });
    expect(resolveBookSyncGate(settings, { remote: 'gdrive' })).toEqual({
      readest: false,
      backends: ['gdrive'],
    });
  });

  test('a disabled backend leaves its books with no provider', () => {
    const settings = makeSettings({
      readestCloud: { enabled: true },
      webdav: { enabled: false } as never,
    });
    expect(resolveBookSyncGate(settings, { remote: 'webdav' })).toEqual({
      readest: false,
      backends: [],
    });
  });

  test('a book with no remote belongs to this device and syncs nowhere', () => {
    const gate = resolveBookSyncGate(makeSettings(), {});
    expect(gate).toEqual({ readest: false, backends: [] });
  });

  test('switching Readest Cloud off leaves a BookRoom book without a provider', () => {
    const settings = makeSettings({ readestCloud: { enabled: false } });
    expect(resolveBookSyncGate(settings, { remote: 'bookroom' }).readest).toBe(false);
  });
});

describe('syncsBookToBookRoom / hasBookSyncTarget', () => {
  test('only BookRoom books are stored in BookRoom', () => {
    expect(syncsBookToBookRoom(makeSettings(), { remote: 'bookroom' })).toBe(true);
    expect(syncsBookToBookRoom(makeSettings(), { remote: 'webdav' })).toBe(false);
    expect(syncsBookToBookRoom(makeSettings(), {})).toBe(false);
  });

  test('a book has a target when its own remote is enabled', () => {
    const settings = makeSettings({
      readestCloud: { enabled: false },
      webdav: { enabled: true } as never,
    });
    expect(hasBookSyncTarget(settings, { remote: 'webdav' })).toBe(true);
    expect(hasBookSyncTarget(settings, { remote: 'bookroom' })).toBe(false);
  });
});

describe('applySyncBooksAutoEnable (upgrade migration for already-enabled providers)', () => {
  test('flips syncBooks on for an enabled webdav provider, mutating the given settings', () => {
    const settings = makeSettings({
      webdav: { enabled: true, syncBooks: false },
    } as Partial<SystemSettings>);
    expect(applySyncBooksAutoEnable(settings)).toBe(true);
    expect(settings.webdav?.syncBooks).toBe(true);
  });

  test('flips syncBooks on for an enabled gdrive provider', () => {
    const settings = makeSettings({
      googleDrive: { enabled: true, syncBooks: false },
    } as Partial<SystemSettings>);
    expect(applySyncBooksAutoEnable(settings)).toBe(true);
    expect(settings.googleDrive?.syncBooks).toBe(true);
  });

  test('no-op when readest is the provider', () => {
    const settings = makeSettings();
    expect(applySyncBooksAutoEnable(settings)).toBe(false);
    expect(settings.webdav?.syncBooks).toBeUndefined();
  });

  test('no-op when syncBooks is already on', () => {
    const settings = makeSettings({
      webdav: { enabled: true, syncBooks: true },
    } as Partial<SystemSettings>);
    expect(applySyncBooksAutoEnable(settings)).toBe(false);
  });

  test('flips syncBooks on for every enabled provider when multiple are enabled', () => {
    const settings = makeSettings({
      webdav: { enabled: true, syncBooks: false },
      googleDrive: { enabled: true, syncBooks: false },
    } as Partial<SystemSettings>);
    expect(applySyncBooksAutoEnable(settings)).toBe(true);
    expect(settings.webdav?.syncBooks).toBe(true);
    expect(settings.googleDrive?.syncBooks).toBe(true);
  });
});

describe('settingsKeyForBackend', () => {
  test('maps each backend kind to its settings slice', () => {
    expect(settingsKeyForBackend('webdav')).toBe('webdav');
    expect(settingsKeyForBackend('gdrive')).toBe('googleDrive');
    expect(settingsKeyForBackend('s3')).toBe('s3');
    expect(settingsKeyForBackend('onedrive')).toBe('onedrive');
  });
});

describe('cloudProviderDisplayName', () => {
  test('names every provider kind', () => {
    expect(cloudProviderDisplayName('webdav')).toBe('WebDAV');
    expect(cloudProviderDisplayName('gdrive')).toBe('Google Drive');
    expect(cloudProviderDisplayName('s3')).toBe('S3');
    expect(cloudProviderDisplayName('onedrive')).toBe('OneDrive');
    expect(cloudProviderDisplayName('readest')).toBe('Readest Cloud');
  });
});

// Moved from src/__tests__/services/sync/file/providerRegistry.test.ts: the
// function itself moved from providerRegistry.ts into this module.
describe('getActiveFileSyncBackends', () => {
  test('lists only switched-on backends in a stable order', () => {
    expect(getActiveFileSyncBackends(s({}))).toEqual([]);
    expect(getActiveFileSyncBackends(s({ webdav: { enabled: true } } as never))).toEqual([
      'webdav',
    ]);
    expect(
      getActiveFileSyncBackends(
        s({ webdav: { enabled: true }, googleDrive: { enabled: true } } as never),
      ),
    ).toEqual(['webdav', 'gdrive']);
    expect(
      getActiveFileSyncBackends(
        s({ webdav: { enabled: false }, googleDrive: { enabled: true } } as never),
      ),
    ).toEqual(['gdrive']);
  });

  test("getActiveFileSyncBackends includes 'onedrive' when enabled", () => {
    expect(getActiveFileSyncBackends(s({ onedrive: { enabled: true } } as never))).toContain(
      'onedrive',
    );
  });
});

describe('isReadestCloudEnabled (derived default)', () => {
  test('absent field with no third-party enabled means Readest Cloud is on', () => {
    expect(isReadestCloudEnabled(s({}))).toBe(true);
  });

  test('absent field still means Readest Cloud is on next to a third-party provider', () => {
    // ADR 0010: providers are independent, so enabling a backend no longer
    // takes the library away from BookRoom.
    expect(isReadestCloudEnabled(s({ googleDrive: { enabled: true } as never }))).toBe(true);
  });

  test('explicit true wins over an enabled third-party provider', () => {
    const settings = s({
      googleDrive: { enabled: true } as never,
      readestCloud: { enabled: true },
    });
    expect(isReadestCloudEnabled(settings)).toBe(true);
  });

  test('explicit false wins when nothing else is enabled', () => {
    expect(isReadestCloudEnabled(s({ readestCloud: { enabled: false } }))).toBe(false);
  });
});

describe('getCloudSyncProviders', () => {
  test('returns readest alone by default', () => {
    expect(getCloudSyncProviders(s({}))).toEqual(['readest']);
  });

  test('returns readest plus every enabled backend in fixed order', () => {
    const settings = s({
      readestCloud: { enabled: true },
      onedrive: { enabled: true } as never,
      webdav: { enabled: true } as never,
    });
    expect(getCloudSyncProviders(settings)).toEqual(['readest', 'webdav', 'onedrive']);
  });

  test('returns an empty list when everything is off', () => {
    expect(getCloudSyncProviders(s({ readestCloud: { enabled: false } }))).toEqual([]);
  });
});

describe('cloudProvidersDisplayName', () => {
  test('joins provider names for the "synced via" copy', () => {
    expect(cloudProvidersDisplayName(['readest', 'gdrive'])).toBe('Readest Cloud, Google Drive');
  });
});

describe('icloud backend kind', () => {
  test('getActiveFileSyncBackends appends icloud last', () => {
    expect(
      getActiveFileSyncBackends(
        s({ webdav: { enabled: true }, icloud: { enabled: true } } as never),
      ),
    ).toEqual(['webdav', 'icloud']);
  });

  test('settingsKeyForBackend maps icloud to its own slice', () => {
    expect(settingsKeyForBackend('icloud')).toBe('icloud');
  });

  test('cloudProviderDisplayName names iCloud', () => {
    expect(cloudProviderDisplayName('icloud')).toBe('iCloud');
  });

  test('applySyncBooksAutoEnable flips syncBooks on for an enabled icloud', () => {
    const settings = s({ icloud: { enabled: true, syncBooks: false } } as never);
    expect(applySyncBooksAutoEnable(settings)).toBe(true);
    expect(settings.icloud?.syncBooks).toBe(true);
  });
});
