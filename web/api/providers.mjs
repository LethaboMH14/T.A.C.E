// Provider registry for the studio's Models view.
//   GET  /api/providers        -> { providers: [{name, tier, configured, models, price}], profile, chain, budget }
//   POST /api/providers/check  -> runs checkProviders(process.env) live, one check at a time
// Keys are read from ctx.env and are never returned: `configured` is a boolean only.
import { PROVIDERS, PROFILES, budgetFromEnv, keyFor, resolveProviders, checkProviders } from '../../engine/providers.mjs';

let checkRunning = false;

/** Public description of the registry. Pure given env; exported for tests. */
export function describeProviders(env = process.env, providers = PROVIDERS) {
  const pool = resolveProviders(env, providers);
  const profile = String(env.MODEL_PROFILE || 'demo');
  const pinned = String(env.MODEL_PROVIDER || '').trim();
  const order = pinned ? [pinned] : (Object.hasOwn(PROFILES, profile) ? PROFILES[profile] : []);
  const chain = order.filter((n) => Object.hasOwn(pool, n) && keyFor(pool[n], env)).map((n) => pool[n].name);
  return {
    providers: Object.values(pool).map((p) => ({
      name: p.name,
      tier: p.tier,
      configured: keyFor(p, env) !== null,
      models: { fast: p.models.fast, strong: p.models.strong },
      price: p.price ? { inPerM: p.price.inPerM, outPerM: p.price.outPerM } : null,
    })),
    profile: pinned ? `pin:${pinned}` : profile,
    chain,
    budget: budgetFromEnv(env),
  };
}

export async function handle(req, res, url, parts, ctx) {
  if (parts[0] !== 'api' || parts[1] !== 'providers') return false;

  if (parts.length === 2 && req.method === 'GET') {
    ctx.send(res, 200, describeProviders(ctx.env));
    return true;
  }

  if (parts.length === 3 && parts[2] === 'check' && req.method === 'POST') {
    const body = await ctx.readJson(req, res);
    if (body === null) return true; // readJson has already answered
    if (checkRunning) {
      ctx.send(res, 409, { error: 'a provider check is already running; wait for it to finish' });
      return true;
    }
    checkRunning = true;
    try {
      const rows = await checkProviders(ctx.env);
      ctx.send(res, 200, { checkedAt: new Date().toISOString(), rows });
    } catch {
      ctx.send(res, 500, { error: 'provider check failed' });
    } finally {
      checkRunning = false;
    }
    return true;
  }

  return false;
}
