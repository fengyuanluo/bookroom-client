// Loopback media server for audio stored on disk (native platforms only).
//
// The Rust side serves byte ranges of a local file over 127.0.0.1 so a media
// element can stream and seek a long recording without the WebView reading it
// whole first.

import { invoke } from '@tauri-apps/api/core';
import { stat } from '@tauri-apps/plugin-fs';
import { getInitializedAppService, isTauriAppPlatform } from '@/services/environment';

/**
 * A loopback URL serving bytes [start, end) of a local file, with `Range`
 * support, so a media element can stream and seek audio stored inside a book
 * without the file being read into the WebView first. Null on the web and iOS,
 * or when the file is outside the asset scope.
 */
export const getMediaFileUrl = async (
  path: string,
  start: number,
  end: number,
  contentType: string,
): Promise<string | null> => {
  if (!isTauriAppPlatform() || getInitializedAppService()?.isIOSApp) return null;
  try {
    return await invoke<string>('get_media_file_url', { path, start, end, contentType });
  } catch (error) {
    console.warn('media proxy cannot serve the book file:', error);
    return null;
  }
};

/**
 * getMediaFileUrl for a whole local audio file. On desktop the asset protocol
 * answers a range request with at most 1,000 KiB, and macOS WebKit gives up on
 * a recording whose index is bigger than that: a long M4B reports "The
 * operation is not supported" and stays silent (#6848).
 */
export const getLocalMediaUrl = async (
  path: string,
  contentType: string,
): Promise<string | null> => {
  const size = await stat(path).then(
    (info) => info.size,
    () => null,
  );
  return size === null ? null : await getMediaFileUrl(path, 0, size, contentType);
};
