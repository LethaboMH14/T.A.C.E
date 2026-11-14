import type { ReactNode } from 'react';

/** Fixed-height workspace: sidebar + (top bar, main). Panels scroll inside themselves on desktop. */
export function AppShell({ sidebar, topbar, children }: { sidebar: ReactNode; topbar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg font-sans text-ink max-[719px]:h-auto max-[719px]:min-h-screen max-[719px]:flex-col max-[719px]:overflow-visible">
      {sidebar}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col max-[719px]:min-h-screen">
        <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-5 py-2.5 max-[719px]:flex-wrap max-[719px]:px-3">{topbar}</div>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden max-[719px]:overflow-visible">{children}</main>
      </div>
    </div>
  );
}
