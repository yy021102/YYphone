import type { ReactNode } from 'react';
import { LocalAccessPreviewGate } from './LocalAccessPreviewGate';
import { AccountAccessGate } from './AccountAccessGate';

export function FirstUseGate({ children }: { children: ReactNode; passwordHash?: string; scope?: string }) {
  if (import.meta.env.VITE_SERVER_ACCESS_GATE) return children;
  if (import.meta.env.DEV) return <LocalAccessPreviewGate>{children}</LocalAccessPreviewGate>;
  return <AccountAccessGate>{children}</AccountAccessGate>;
}
