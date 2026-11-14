import { LMS_KEY, LMS_URL } from '../config';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// The database says "Please log in again" (or similar) when a token is no longer valid.
export const isRelogin = (e: unknown): boolean => e instanceof ApiError && /log(ged)?[ -]?in again|session (has )?expired|invalid token/i.test(e.message);

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${LMS_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: LMS_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch {
    throw new ApiError('No connection to the T.A.C.E workspace. Check the Wi-Fi and try again.', 0);
  }
  const body = (await res.json().catch(() => null)) as { message?: string } | T | null;
  if (!res.ok) {
    const msg = body && typeof body === 'object' && 'message' in body && body.message ? String(body.message) : `Request failed (HTTP ${res.status}).`;
    throw new ApiError(msg, res.status);
  }
  return body as T;
}
