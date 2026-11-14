import { createContext, useContext } from 'react';
import type { Session } from './session';
import type { Kind, Me, Message } from './types';

export interface PortalCtx {
  kind: Kind;
  session: Session;
  me: Me | null;
  meError: string | null;
  reloadMe: () => Promise<void>;
  messages: Message[] | null;
  inboxError: string | null;
  refreshInbox: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  unread: number;
  call: <T>(fn: string, args?: Record<string, unknown>) => Promise<T>;
  logout: () => void;
}

export const PortalContext = createContext<PortalCtx | null>(null);

export function usePortal(): PortalCtx {
  const v = useContext(PortalContext);
  if (!v) throw new Error('usePortal used outside the portal');
  return v;
}
