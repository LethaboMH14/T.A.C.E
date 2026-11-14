import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { scoreBar, sourceLabel } from '../lib/helpers';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-field px-4 py-2.5 text-[15px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-card hover:bg-accent-ink',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent-weak',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink',
  danger: 'border border-bad-line bg-bad-weak text-bad hover:bg-bad hover:text-white',
};

export function Button({ variant = 'secondary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}

export function Card({ children, className = '', interactive = false }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return (
    <section
      className={`rounded-card border border-line bg-surface p-5 shadow-card transition-[border-color,box-shadow] duration-150 ${
        interactive ? 'hover:border-accent/50 hover:shadow-lift' : ''
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'bad' | 'run'; children: ReactNode }) {
  const cls = {
    info: 'border-line bg-sunken text-ink-2',
    ok: 'border-ok-line bg-ok-weak text-ok',
    bad: 'border-bad-line bg-bad-weak text-bad',
    run: 'border-run-line bg-run-weak text-run',
  }[tone];
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={`rounded-field border px-4 py-3 text-[15px] leading-relaxed ${cls}`}>
      {children}
    </div>
  );
}

export function PageTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-[28px] font-bold leading-tight text-ink lg:text-[34px]">{title}</h1>
      {lead && <p className="mt-2 max-w-prose text-[16px] leading-relaxed text-ink-2">{lead}</p>}
    </header>
  );
}

export function Loading({ what }: { what: string }) {
  return <p className="py-10 text-center text-[16px] text-ink-3">Loading {what}…</p>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface p-6 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 text-[15px] text-ink-3">{children}</p>}
    </div>
  );
}

export function ScoreBar({ score, threshold }: { score: number | null; threshold: number }) {
  const b = scoreBar(score, threshold);
  const fill = b.status === 'ok' ? 'bg-ok' : b.status === 'bad' ? 'bg-bad' : 'bg-line-strong';
  const label = score === null ? `No score yet. Pass line ${threshold}.` : `Score ${score} of 100. Pass line ${threshold}.`;
  return (
    <div className="relative h-3 w-full rounded-full bg-sunken" role="img" aria-label={label}>
      <div className={`h-full rounded-full transition-[width] duration-500 ease-studio ${fill}`} style={{ width: `${b.fill}%` }} />
      <div className="absolute -bottom-1 -top-1 w-0.5 bg-ink" style={{ left: `calc(${b.markAt}% - 1px)` }} />
    </div>
  );
}

export function SourceBadge({ source }: { source: string }) {
  return <span className="rounded-full border border-line bg-sunken px-2 py-0.5 text-[13px] font-medium text-ink-2">{sourceLabel(source)}</span>;
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[13px] text-ink-3">{children}</span>;
}

// One clear next step for the person on this screen.
export function NextStep({ children, href, label }: { children: ReactNode; href?: string; label?: string }) {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-card border border-accent/30 bg-accent-weak p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[16px] leading-relaxed text-ink">
        <span className="font-semibold text-accent-ink">Next: </span>
        {children}
      </p>
      {href && label && (
        <a
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-field bg-accent px-4 text-[15px] font-semibold text-white transition-colors hover:bg-accent-ink"
        >
          {label}
        </a>
      )}
    </div>
  );
}
