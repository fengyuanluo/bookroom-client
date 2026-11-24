import { useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useEnv } from '@/context/EnvContext';
import { getFlowConnectors } from '@/services/sync/dataFlow/connectors';
import { readFlowState, subscribeFlowState } from '@/services/sync/dataFlow/log';
import { useCustomOPDSStore } from '@/store/customOPDSStore';
import { useSettingsStore } from '@/store/settingsStore';

export const useFlowConnectors = () => {
  const { envConfig } = useEnv();
  const { user } = useAuth();
  const { settings } = useSettingsStore();
  const opdsCatalogs = useCustomOPDSStore((s) => s.catalogs);
  return useMemo(
    () => getFlowConnectors({ settings, signedIn: !!user, envConfig, opdsCatalogs }),
    [settings, user, envConfig, opdsCatalogs],
  );
};

export const useFlowState = () =>
  useSyncExternalStore(subscribeFlowState, readFlowState, readFlowState);
