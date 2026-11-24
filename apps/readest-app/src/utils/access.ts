import { getSession, getValidAccessToken } from '@/services/bookroom/session';

/** The BookRoom access token for API calls, refreshed when about to expire. */
export const getAccessToken = async (): Promise<string | null> => getValidAccessToken();

/** The signed-in BookRoom user's id; cloud storage keys are prefixed with it. */
export const getUserID = async (): Promise<string | null> => getSession()?.user.id ?? null;
