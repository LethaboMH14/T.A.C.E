import { Delete } from 'lucide-react';
import { useEffect } from 'react';

// Numeric keypad PIN entry (4 to 8 digits). Also accepts the physical keyboard while mounted.
export function PinPad({ value, onChange, max = 8, onSubmit }: { value: string; onChange: (v: string) => void; max?: number; onSubmit?: () => void }) {
  const press = (d: string) => value.length < max && onChange(value + d);
  const back = () => onChange(value.slice(0, -1));

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter' && onSubmit) onSubmit();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];
  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="mb-5 flex justify-center gap-2" aria-live="polite" aria-label={`${value.length} digits entered`}>
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border ${i < value.length ? 'border-accent bg-accent' : 'border-line-strong bg-surface'}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : k === 'back' ? (
            <button
              key={i}
              type="button"
              onClick={back}
              aria-label="Delete last digit"
              className="flex min-h-14 items-center justify-center rounded-field border border-line bg-surface text-ink-2 transition-colors hover:border-accent hover:bg-accent-weak"
            >
              <Delete size={22} aria-hidden />
            </button>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              className="min-h-14 rounded-field border border-line bg-surface font-mono text-[22px] font-medium text-ink transition-colors hover:border-accent hover:bg-accent-weak"
            >
              {k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
