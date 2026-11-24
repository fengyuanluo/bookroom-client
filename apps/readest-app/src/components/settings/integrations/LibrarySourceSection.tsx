import React, { useMemo } from 'react';
import type { BookRemote } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { saveSysSettings } from '@/helpers/settings';
import {
  bookRemote,
  catalogOfRemote,
  getCurrentRemote,
  isFileSyncRemote,
  opdsRemote,
} from '@/services/remote';
import {
  cloudProviderDisplayName,
  getActiveFileSyncBackends,
} from '@/services/sync/cloudSyncProvider';
import { BoxedList, SettingsRow, SettingsSelect } from '../primitives';

/**
 * The remote whose books the library shows (ADR 0010). Every connected remote
 * is offered, plus any a book on this device still belongs to, so the books of
 * a disconnected backend or a removed catalog stay reachable.
 */
const LibrarySourceSection: React.FC = () => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const library = useLibraryStore((state) => state.library);
  const currentRemote = getCurrentRemote(settings);

  const options = useMemo(() => {
    const keys = new Set<BookRemote>(['bookroom', 'local', ...getActiveFileSyncBackends(settings)]);
    for (const catalog of settings.opdsCatalogs ?? []) {
      if (!catalog.deletedAt) keys.add(opdsRemote(catalog));
    }
    for (const book of library) {
      if (!book.deletedAt) keys.add(bookRemote(book));
    }
    keys.add(currentRemote);
    const labelOf = (key: BookRemote) =>
      key === 'bookroom'
        ? 'BookRoom'
        : key === 'local'
          ? _('This Device')
          : isFileSyncRemote(key)
            ? cloudProviderDisplayName(key)
            : (catalogOfRemote(settings, key)?.name ?? 'OPDS');
    return [...keys].map((key) => ({ value: key, label: labelOf(key) }));
  }, [_, settings, library, currentRemote]);

  return (
    <BoxedList
      title={_('Library Source')}
      description={_(
        'The library shows the books of one source. Each book syncs its shelves, progress and notes only with the source it came from.',
      )}
      data-setting-id='settings.integrations.librarySource'
    >
      <SettingsRow label={_('Show Books From')}>
        <SettingsSelect
          value={currentRemote}
          onChange={(e) =>
            saveSysSettings(envConfig, 'currentRemote', e.target.value as BookRemote)
          }
          options={options}
          ariaLabel={_('Show Books From')}
        />
      </SettingsRow>
    </BoxedList>
  );
};

export default LibrarySourceSection;
