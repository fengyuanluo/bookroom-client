import { getAPIBaseUrl } from '@/services/environment';
import { getValidAccessToken } from './session';

/**
 * Headers for BookRoom's web proxies (`/api/kosync`, `/api/grimmory`, …). The
 * web build cannot reach those services cross-origin, so it forwards through
 * BookRoom, which only serves signed-in users.
 */
export const bookRoomProxyHeaders = async (
  headers: Record<string, string> = {},
): Promise<Record<string, string>> => {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Sign in to BookRoom to use this service on the web');
  return { ...headers, Authorization: `Bearer ${token}` };
};

/** POSTs a JSON forward request to one of BookRoom's web proxies, e.g. `/kosync`. */
export const postToBookRoomProxy = async (path: string, payload: unknown): Promise<Response> =>
  fetch(`${getAPIBaseUrl()}${path}`, {
    method: 'POST',
    headers: await bookRoomProxyHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
