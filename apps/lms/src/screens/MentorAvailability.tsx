import { useEffect, useState } from 'react';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { Button, Card, Loading, Notice, PageTitle } from '../components/ui';
import { usePortal } from '../lib/ctx';
import { cellsFromWindows, windowsFromCells } from '../lib/helpers';

export function MentorAvailability() {
  const { me, meError, call, reloadMe } = usePortal();
  const [cells, setCells] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  // Rebuild the grid from the windows the database holds.
  const windowsKey = JSON.stringify(me?.availability ?? []);
  useEffect(() => {
    if (me) setCells(cellsFromWindows(me.availability));
  }, [windowsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (meError) return <Notice tone="bad">{meError}</Notice>;
  if (!me) return <Loading what="availability" />;

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      const windows = windowsFromCells(cells);
      await call('lms_set_availability', { p_windows: windows });
      await reloadMe();
      setNote({ tone: 'ok', text: `Saved ${windows.length} window(s).` });
    } catch (e) {
      setNote({ tone: 'bad', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Availability" lead="Tap each hour you can meet a learner. Hours next to each other are saved as one block." />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-6">
        <Card className="p-3 sm:p-5">
          <AvailabilityGrid cells={cells} onChange={setCells} />
          <p className="mt-3 text-[13px] text-ink-3">Each box is one hour, starting on the hour. Monday to Friday, 08:00 to 17:00.</p>
        </Card>
        <div className="mt-4 space-y-4 lg:mt-0">
          <Card>
            <p className="text-[14px] text-ink-3">Hours selected</p>
            <p className="font-mono text-[28px] font-semibold text-ink">{cells.size}</p>
            <Button variant="primary" onClick={save} disabled={busy} className="mt-4 w-full">
              {busy ? 'Saving…' : 'Save availability'}
            </Button>
          </Card>
          {note && <Notice tone={note.tone === 'ok' ? 'ok' : 'bad'}>{note.text}</Notice>}
        </div>
      </div>
    </>
  );
}
