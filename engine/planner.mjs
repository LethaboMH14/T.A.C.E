// Goal deliverables -> the minimal set of tasks needed to produce them.
// Pure functions. Every iteration is sorted, so the same inputs always give the same plan.

function graphError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

/**
 * Plan the tasks needed for the requested kinds.
 * @param {{producersOf: (kind:string)=>object[], get: (id:string)=>object|null}} registry
 * @param {string[]} requestedKinds
 * @param {string[]} availableKinds  kinds already on hand (e.g. admitted sources); need no task
 * @returns {{ tasks: object[], unsupported: string[] }}
 */
export function planTasks(registry, requestedKinds, availableKinds = []) {
  const available = new Set(availableKinds);
  const requested = uniqueSorted(requestedKinds);

  // kind -> { ok, capId, root }   (root = the leaf kind with no producer that blocked it)
  const kindMemo = new Map();
  // capId -> { ok, root }
  const capMemo = new Map();

  function resolveCap(cap, path) {
    if (capMemo.has(cap.id)) return capMemo.get(cap.id);
    if (path.includes(cap.id)) {
      throw graphError('PLAN_CYCLE', `producer cycle: ${[...path, cap.id].join(' -> ')}`);
    }
    const nextPath = [...path, cap.id];
    let result = { ok: true, root: null };
    for (const kind of uniqueSorted(cap.consumes)) {
      if (available.has(kind)) continue;
      const r = resolveKind(kind, nextPath);
      if (!r.ok) {
        result = { ok: false, root: r.root };
        break;
      }
    }
    capMemo.set(cap.id, result);
    return result;
  }

  function resolveKind(kind, path) {
    if (available.has(kind)) return { ok: true, capId: null, root: null };
    if (kindMemo.has(kind)) return kindMemo.get(kind);
    const producers = registry.producersOf(kind);
    if (producers.length === 0) return { ok: false, capId: null, root: kind };
    const cap = producers[0];
    const res = resolveCap(cap, path);
    const out = res.ok
      ? { ok: true, capId: cap.id, root: null }
      : { ok: false, capId: null, root: res.root };
    kindMemo.set(kind, out);
    return out;
  }

  const unsupported = new Set();
  for (const kind of requested) {
    if (available.has(kind)) continue;
    const r = resolveKind(kind, []);
    if (!r.ok) {
      unsupported.add(kind);
      unsupported.add(r.root);
    }
  }

  // Collect only the capabilities reachable from successfully satisfied requests.
  const needed = new Set();
  function collect(kind) {
    if (available.has(kind)) return;
    const r = kindMemo.get(kind);
    if (!r || !r.ok || needed.has(r.capId)) return;
    needed.add(r.capId);
    for (const k of uniqueSorted(registry.get(r.capId).consumes)) collect(k);
  }
  for (const kind of requested) {
    if (!available.has(kind) && kindMemo.get(kind)?.ok) collect(kind);
  }

  const tasks = [...needed].sort().map((capId) => {
    const cap = registry.get(capId);
    const dependsOn = uniqueSorted(
      cap.consumes.filter((k) => !available.has(k)).map((k) => kindMemo.get(k).capId),
    );
    return {
      id: cap.id,
      capabilityId: cap.id,
      role: cap.role,
      label: cap.label,
      dependsOn,
      consumes: [...cap.consumes],
      produces: [...cap.produces],
    };
  });

  validateGraph(tasks);
  const ordered = topoOrder(tasks);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return {
    tasks: ordered.map((id) => byId.get(id)),
    unsupported: uniqueSorted([...unsupported]),
  };
}

/** Structural checks shared by validateGraph and topoOrder. */
function checkStructure(tasks) {
  const ids = new Set();
  for (const t of tasks) {
    if (ids.has(t.id)) throw graphError('DUPLICATE_TASK', `duplicate task id: ${t.id}`);
    ids.add(t.id);
  }
  for (const t of tasks) {
    for (const d of t.dependsOn ?? []) {
      if (!ids.has(d)) {
        throw graphError('UNKNOWN_DEPENDENCY', `task ${t.id} depends on unknown task ${d}`);
      }
    }
  }
}

/** Kahn's algorithm. Ties broken by smallest id. Throws PLAN_CYCLE when a cycle remains. */
function kahn(tasks) {
  const indegree = new Map();
  const children = new Map();
  for (const t of tasks) {
    indegree.set(t.id, uniqueSorted(t.dependsOn ?? []).length);
    if (!children.has(t.id)) children.set(t.id, []);
  }
  for (const t of tasks) {
    for (const d of uniqueSorted(t.dependsOn ?? [])) children.get(d).push(t.id);
  }
  let ready = tasks.filter((t) => indegree.get(t.id) === 0).map((t) => t.id).sort();
  const order = [];
  while (ready.length > 0) {
    const id = ready.shift();
    order.push(id);
    let added = false;
    for (const child of children.get(id).sort()) {
      const left = indegree.get(child) - 1;
      indegree.set(child, left);
      if (left === 0) {
        ready.push(child);
        added = true;
      }
    }
    if (added) ready.sort();
  }
  if (order.length !== tasks.length) {
    const stuck = tasks.map((t) => t.id).filter((id) => !order.includes(id)).sort();
    throw graphError('PLAN_CYCLE', `dependency cycle among: ${stuck.join(', ')}`);
  }
  return order;
}

/** Throws DUPLICATE_TASK, UNKNOWN_DEPENDENCY or PLAN_CYCLE. */
export function validateGraph(tasks) {
  checkStructure(tasks);
  kahn(tasks);
}

/** Task ids in dependency order, ties by id. */
export function topoOrder(tasks) {
  checkStructure(tasks);
  return kahn(tasks);
}

/** Ids of every task that transitively depends on `id`, in topo order, excluding `id`. */
export function descendants(tasks, id) {
  const children = new Map();
  for (const t of tasks) {
    for (const d of t.dependsOn ?? []) {
      if (!children.has(d)) children.set(d, []);
      children.get(d).push(t.id);
    }
  }
  const found = new Set();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const child of children.get(current) ?? []) {
      if (!found.has(child) && child !== id) {
        found.add(child);
        queue.push(child);
      }
    }
  }
  return topoOrder(tasks).filter((tid) => found.has(tid));
}
