import { AppService } from '@/types/system';
import { getServerUrl } from './bookroom/session';
import { getOSPlatform } from '@/utils/misc';

declare global {
  interface Window {
    __READEST_CLI_ACCESS?: boolean;
  }
}

export const isTauriAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'tauri';
export const isWebAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'web';
export const hasCli = () => window.__READEST_CLI_ACCESS === true;
export const isPWA = () => window.matchMedia('(display-mode: standalone)').matches;
/**
 * The BookRoom server origin. The web build is served by BookRoom itself, so
 * it defaults to its own origin; native builds use the server chosen at
 * sign-in and have none before it.
 */
export const getBaseUrl = () =>
  getServerUrl() ??
  (isWebAppPlatform() && typeof window !== 'undefined' ? window.location.origin : '');

/**
 * Whether window move/resize has to be driven from JS with pointer events.
 * Linux runs on CEF, where the mouse press is owned by Chromium's X
 * connection: the runtime's `startDragging` (`_NET_WM_MOVERESIZE` from winit's
 * connection) is refused by the window manager, and the undecorated window has
 * no native resize borders either. Every other platform keeps the runtime's
 * own drag.
 */
export const needsPointerWindowControls = () =>
  isTauriAppPlatform() && typeof navigator !== 'undefined' && getOSPlatform() === 'linux';

export const isMacPlatform = () =>
  typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const getCommandPaletteShortcut = () => (isMacPlatform() ? '⌘⇧P' : 'Ctrl+Shift+P');

export const getAPIBaseUrl = () => `${getBaseUrl()}/api`;

export interface EnvConfigType {
  getAppService: () => Promise<AppService>;
}

let nativeAppService: AppService | null = null;
const getNativeAppService = async () => {
  if (!nativeAppService) {
    const { NativeAppService } = await import('@/services/nativeAppService');
    // Publish the singleton only after `init` resolves. Assigning first meant a
    // failed init left a half-built service cached forever: every later caller
    // got it back without re-running init, and `getInitializedAppService`
    // handed synchronous callers an object whose paths were never resolved.
    const service = new NativeAppService();
    await service.init();
    nativeAppService = service;
  }
  return nativeAppService;
};

let webAppService: AppService | null = null;
const getWebAppService = async () => {
  if (!webAppService) {
    const { WebAppService } = await import('@/services/webAppService');
    const service = new WebAppService();
    await service.init();
    webAppService = service;
  }
  return webAppService;
};

const environmentConfig: EnvConfigType = {
  getAppService: async () => {
    if (isTauriAppPlatform()) {
      return getNativeAppService();
    } else {
      return getWebAppService();
    }
  },
};

/**
 * Synchronously returns the app service if it has already been created by
 * {@link environmentConfig.getAppService}; null before first init. The async
 * getter is preferred everywhere — use this only from synchronous code paths
 * that run well after startup (e.g. capability checks during reader render),
 * where the singleton is guaranteed to exist.
 */
export const getInitializedAppService = (): AppService | null => nativeAppService ?? webAppService;

export default environmentConfig;
