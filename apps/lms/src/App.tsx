import { Portal } from './components/Portal';
import { Public } from './components/Public';
import { useRoute } from './lib/route';
import { getSession } from './lib/session';
import { Create } from './screens/Create';
import { Pick } from './screens/Pick';
import { Pin } from './screens/Pin';
import { Resume } from './screens/Resume';
import { Welcome } from './screens/Welcome';

// Hash routes: #/ · #/pick/learner · #/pin/L-12 · #/create · #/learner/... · #/mentor/...
export function App() {
  const [head, ...rest] = useRoute();
  if (!head) {
    const saved = getSession();
    return saved ? <Resume session={saved} /> : <Welcome />;
  }
  if (head === 'pick' && (rest[0] === 'learner' || rest[0] === 'mentor')) return <Pick kind={rest[0]} />;
  if (head === 'pin' && rest[0]) return <Pin id={rest[0]} />;
  if (head === 'create') return <Create />;
  if (head === 'learner' || head === 'mentor') return <Portal kind={head} sub={rest} />;
  return (
    <Public back={{ href: '#/', label: 'Start' }}>
      <p className="py-12 text-center text-[18px] text-ink">This page does not exist.</p>
    </Public>
  );
}
