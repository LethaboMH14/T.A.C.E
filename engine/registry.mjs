// Capability registry. A capability is a deterministic worker that consumes kinds and produces kinds.
// No domain logic lives here: the registry only validates shapes and answers lookups.
//
// Capability shape: { id, role, label, consumes: string[], produces: string[], run: function }

const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

function badCapability(message) {
  const err = new Error(message);
  err.code = 'BAD_CAPABILITY';
  return err;
}

/**
 * @param {Array<object>} capabilities
 * @returns {{ all: () => object[], get: (id: string) => object|null, producersOf: (kind: string) => object[] }}
 */
export function createRegistry(capabilities) {
  if (!Array.isArray(capabilities)) throw badCapability('capabilities must be an array');

  const seen = new Set();
  const normalized = [];

  for (const cap of capabilities) {
    if (cap === null || typeof cap !== 'object') throw badCapability('capability must be an object');
    if (typeof cap.id !== 'string' || !ID_PATTERN.test(cap.id)) {
      throw badCapability(`capability id invalid: ${String(cap.id)}`);
    }
    if (seen.has(cap.id)) throw badCapability(`duplicate capability id: ${cap.id}`);
    seen.add(cap.id);

    const consumes = cap.consumes ?? [];
    if (!Array.isArray(consumes) || consumes.some((k) => typeof k !== 'string')) {
      throw badCapability(`capability ${cap.id}: consumes must be an array of strings`);
    }
    if (!Array.isArray(cap.produces) || cap.produces.length === 0 ||
        cap.produces.some((k) => typeof k !== 'string')) {
      throw badCapability(`capability ${cap.id}: produces must be a non-empty array of strings`);
    }
    if (typeof cap.run !== 'function') {
      throw badCapability(`capability ${cap.id}: run must be a function`);
    }

    normalized.push({
      id: cap.id,
      role: cap.role,
      label: cap.label,
      consumes: [...consumes],
      produces: [...cap.produces],
      run: cap.run,
    });
  }

  normalized.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map(normalized.map((cap) => [cap.id, cap]));

  return {
    all() {
      return [...normalized];
    },
    get(id) {
      return byId.get(id) ?? null;
    },
    producersOf(kind) {
      return normalized.filter((cap) => cap.produces.includes(kind));
    },
  };
}
