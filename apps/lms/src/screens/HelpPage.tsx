import { HelpForm } from '../components/HelpForm';
import { Card, Loading, NextStep, Notice, PageTitle } from '../components/ui';
import { usePortal } from '../lib/ctx';

export function HelpPage() {
  const { me, meError } = usePortal();
  if (meError) return <Notice tone="bad">{meError}</Notice>;
  if (!me) return <Loading what="help" />;
  return (
    <div className="lg:max-w-2xl">
      <PageTitle title="Ask for help" lead="Tell us what is hard, in your own words. Your coordinator reads every request." />
      <Card>
        <HelpForm />
      </Card>
      <NextStep href="#/learner/inbox" label="Open my inbox">
        After you send, check your inbox. Your coordinator replies there with a plan or a session time.
      </NextStep>
    </div>
  );
}
