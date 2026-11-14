import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/10" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-y-0 right-0 z-50 flex w-[min(720px,100vw)] flex-col border-l border-line bg-surface shadow-[-24px_0_48px_-20px_rgba(20,22,37,.25)] focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-field border border-line bg-surface text-ink-2 hover:bg-sunken">
        <X className="h-4 w-4" aria-hidden />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = 'SheetContent';
