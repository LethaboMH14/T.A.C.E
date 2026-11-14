import { useState, type ReactNode } from 'react';
import { useEffect } from 'react';
import { clearFlash, peekFlash } from '../lib/session';
import { Notice } from './ui';

// Frame for screens before sign-in: centred column, phone up to a wide desktop.
export function Public({ children, back }: { children: ReactNode; back?: { href: string; label: string } }) {
  const [flash] = useState(() => peekFlash());
  useEffect(() => {
    clearFlash();
  }, []);
  return (
    <div className="min-h-dvh">
      <div className="gradient-rule" aria-hidden />
      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-6 lg:max-w-2xl lg:pt-12">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="font-display text-[15px] font-bold text-ink">T.A.C.E Learner Portal</p>
          {back && (
            <a href={back.href} className="rounded-field px-3 py-2 text-[15px] font-medium text-accent-ink transition-colors hover:bg-accent-weak">
              {back.label}
            </a>
          )}
        </div>
        {flash && (
          <div className="mb-5">
            <Notice tone="run">{flash}</Notice>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
