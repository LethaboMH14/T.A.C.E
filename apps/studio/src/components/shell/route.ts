// Hash routes for the workspace. Pure parse/format so they can be tested without a browser.
//   #/mission/<runId>   #/mission            (no run yet)
//   #/live              #/missions          #/agents            #/evidence/<runId>   #/files/<runId>   #/models
// Anything else parses to { name: 'home' }; App then sends the person to the latest run.

export type Route =
  | { name: 'home' }
  | { name: 'mission'; runId: string | null }
  | { name: 'live' }
  | { name: 'missions' }
  | { name: 'agents' }
  | { name: 'evidence'; runId: string | null }
  | { name: 'files'; runId: string | null }
  | { name: 'models' };

export const RUN_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return '\u0000';
    }
  });
  const [head, id] = parts;
  const runId = id && RUN_ID_RE.test(id) ? id : null;
  switch (head) {
    case 'mission':
      return { name: 'mission', runId };
    case 'live':
      return { name: 'live' };
    case 'missions':
      return { name: 'missions' };
    case 'agents':
      return { name: 'agents' };
    case 'evidence':
      return { name: 'evidence', runId };
    case 'files':
      return { name: 'files', runId };
    case 'models':
      return { name: 'models' };
    default:
      return { name: 'home' };
  }
}

export function routeHash(route: Route): string {
  switch (route.name) {
    case 'mission':
      return route.runId ? `#/mission/${encodeURIComponent(route.runId)}` : '#/mission';
    case 'live':
      return '#/live';
    case 'missions':
      return '#/missions';
    case 'agents':
      return '#/agents';
    case 'evidence':
      return route.runId ? `#/evidence/${encodeURIComponent(route.runId)}` : '#/evidence';
    case 'files':
      return route.runId ? `#/files/${encodeURIComponent(route.runId)}` : '#/files';
    case 'models':
      return '#/models';
    default:
      return '#/mission';
  }
}

/** Go to a hash route. Pushes history so Back works. */
export function go(route: Route): void {
  const next = routeHash(route);
  if (window.location.hash !== next) window.location.hash = next;
}

/** The run a route is about, if it names one. */
export function routeRunId(route: Route): string | null {
  return route.name === 'mission' || route.name === 'evidence' || route.name === 'files' ? route.runId : null;
}
