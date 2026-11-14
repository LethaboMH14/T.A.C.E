import { DAYS, HOURS } from '../lib/constants';
import { pad2, toggleCell } from '../lib/helpers';

// Mon-Fri by hour (08:00 to 17:00). Fits on screen without scrolling at 375px and up.
export function AvailabilityGrid({ cells, onChange }: { cells: Set<string>; onChange: (next: Set<string>) => void }) {
  return (
    <div role="group" aria-label="Weekly availability, Monday to Friday, hour by hour" className="w-full">
      <div className="grid grid-cols-[52px_repeat(5,minmax(0,1fr))] gap-1.5 text-center">
        <span aria-hidden />
        {DAYS.map((d) => (
          <span key={d} className="pb-1 text-[13px] font-semibold text-ink-2">
            {d}
          </span>
        ))}
        {HOURS.map((h) => (
          <div key={h} className="contents">
            <span className="flex items-center justify-end pr-1 font-mono text-[12px] text-ink-3">{pad2(h)}:00</span>
            {DAYS.map((d) => {
              const key = `${d}|${h}`;
              const on = cells.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${d} ${pad2(h)}:00 to ${pad2(h + 1)}:00, ${on ? 'available' : 'not available'}`}
                  onClick={() => onChange(toggleCell(cells, key))}
                  className={`h-9 rounded-md border text-[12px] font-semibold transition-colors duration-100 lg:h-10 ${
                    on
                      ? 'border-accent bg-accent text-white hover:bg-accent-ink'
                      : 'border-line bg-sunken text-ink-3 hover:border-accent hover:bg-accent-weak hover:text-ink'
                  }`}
                >
                  {on ? 'on' : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
