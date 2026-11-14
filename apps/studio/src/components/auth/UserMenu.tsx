import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { initials } from '@/lib/auth';
import { Popover } from '@/components/ui/popover';
import { useAuth } from './AuthProvider';

/** The signed-in coordinator, with Sign out. Renders nothing when the server does not require sign-in. */
export function UserMenu() {
  const { staff, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  if (!staff) return null;
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      panelClassName="w-[248px] p-1.5"
      trigger={
        <button
          type="button"
          data-popover-trigger
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Account: ${staff.display_name}`}
          className="mono flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface text-[12.5px] font-semibold text-ink-2 hover:bg-sunken"
        >
          {initials(staff.display_name)}
        </button>
      }
    >
      <div role="menu" aria-label="Account">
        <div className="px-2.5 py-2">
          <p className="m-0 truncate text-[14px] font-semibold text-ink">{staff.display_name}</p>
          <p className="m-0 truncate text-[12.5px] text-ink-3">{staff.email}</p>
        </div>
        <button
          type="button"
          role="menuitem"
          autoFocus
          onClick={() => {
            setOpen(false);
            void signOut();
          }}
          className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-field px-2.5 text-left text-[14px] font-medium text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
      </div>
    </Popover>
  );
}
