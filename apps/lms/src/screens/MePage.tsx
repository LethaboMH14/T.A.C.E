import { ContactForm } from '../components/ContactForm';
import { PrefsForm } from '../components/PrefsForm';
import { Card, Loading, Notice, PageTitle } from '../components/ui';
import { usePortal } from '../lib/ctx';

export function MePage() {
  const { me, meError } = usePortal();
  if (meError) return <Notice tone="bad">{meError}</Notice>;
  if (!me) return <Loading what="your profile" />;
  return (
    <>
      <PageTitle title="Me" lead="Choose how you like to read, and in which language. Your plans will follow these." />
      <div className="space-y-4 lg:max-w-2xl">
        <Card>
          <p className="text-[13px] text-ink-3">Profile</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">{me.profile.display_name}</p>
          <p className="mt-1 font-mono text-[13px] text-ink-3">{me.profile.id}</p>
          <div className="mt-6 border-t border-line pt-6">
            <PrefsForm />
          </div>
        </Card>
        <Card>
          <ContactForm />
        </Card>
      </div>
    </>
  );
}
