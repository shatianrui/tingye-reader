import { api, restoreSession, type Session } from './client';
import { nativeLibrary } from './native-library';

/** The reader UI is independent of account transport and library storage. */
export type ReaderServices = {
  restore: () => Promise<Session | null>;
  verify: () => Promise<{ user: Session['user'] | null }>;
  library: typeof nativeLibrary;
};

export const readerServices: ReaderServices = {
  restore: restoreSession,
  verify: () => api('/api/auth?_verify='+Date.now(), {cache:'no-store',headers:{'Cache-Control':'no-cache'},signal: AbortSignal.timeout(10000)}),
  library: nativeLibrary,
};
