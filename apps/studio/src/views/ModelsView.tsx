import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  onProviderCheckRequest,
  takeProviderCheckRequest,
  workspaceApi,
  type ProviderCheckResponse,
  type ProvidersResponse,
} from '@/components/shell/workspace-api';

const isOk = (v: string) => v === 'ok';

export function ModelsView() {
  const [info, setInfo] = useState<ProvidersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<ProviderCheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    workspaceApi
      .providers()
      .then(setInfo)
      .catch((e: Error) => setError(`Could not load providers: ${e.message}`));
  }, []);

  async function runCheck() {
    if (checking) return;
    setChecking(true);
    setCheckError(null);
    try {
      setCheck(await workspaceApi.checkProviders());
    } catch (e) {
      setCheckError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  // The palette asks for a check. Run it once when the request is pending at mount, or when it arrives later.
  useEffect(() => {
    if (takeProviderCheckRequest()) void runCheck();
    return onProviderCheckRequest(() => {
      takeProviderCheckRequest();
      void runCheck();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const configured = info?.providers.filter((p) => p.configured).length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5 max-[719px]:overflow-visible max-[719px]:p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-[-0.01em] text-ink">Models</h1>
          <p className="m-0 mt-0.5 text-[13.5px] text-ink-3">
            {info
              ? `${configured} of ${info.providers.length} providers have a key on this server. Keys are never shown.`
              : error
                ? ''
                : 'Loading providers…'}
          </p>
        </div>
        <Button onClick={() => void runCheck()} disabled={checking || !info}>
          {checking ? 'Checking…' : 'Check providers'}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="m-0 text-[14px] text-bad">
          {error}
        </p>
      ) : null}

      {info ? (
        <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3" aria-label="Run settings">
          <Fact label="Profile" value={info.profile} />
          <Fact label="Chain (order of preference)" value={info.chain.length ? info.chain.join(' → ') : 'No provider in this profile has a key'} />
          <Fact label="Token budget per run" value={`${info.budget.maxTokens.toLocaleString('en-GB')} tokens`} />
          <Fact label="Spend limit per run" value={info.budget.maxUsd === 0 ? '$0 (model calls blocked)' : `$${info.budget.maxUsd}`} />
        </section>
      ) : null}

      {info ? (
        <div className="overflow-auto rounded-card border border-line bg-surface shadow-card max-[719px]:overflow-visible">
          <table className="w-full border-collapse text-left text-[14px]">
            <caption className="sr-only">Providers registered in engine/providers.mjs</caption>
            <thead className="bg-sunken text-[12.5px] text-ink-3">
              <tr>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-medium">Provider</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-medium max-[719px]:hidden">Tier</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-medium">Key</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-medium">Fast model</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-medium max-[719px]:hidden">Strong model</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-medium max-[719px]:hidden">Price per 1M tokens</th>
              </tr>
            </thead>
            <tbody>
              {info.providers.map((p) => (
                <tr key={p.name} data-provider={p.name} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2.5 font-semibold text-ink">
                    {p.name}
                    {info.chain.includes(p.name) ? <span className="ml-2 text-[12px] font-medium text-accent-ink">in chain</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-ink-2 max-[719px]:hidden">{p.tier}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-[12.5px] font-medium', p.configured ? 'bg-ok-weak text-ok' : 'bg-sunken text-ink-3')}>
                      {p.configured ? 'configured' : 'no key'}
                    </span>
                  </td>
                  <td className="mono break-all px-3 py-2.5 text-[12.5px] text-ink-2">{p.models.fast}</td>
                  <td className="mono break-all px-3 py-2.5 text-[12.5px] text-ink-2 max-[719px]:hidden">{p.models.strong}</td>
                  <td className="px-3 py-2.5 text-ink-2 max-[719px]:hidden">{p.price ? `$${p.price.inPerM} in / $${p.price.outPerM} out` : 'not published'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <section aria-labelledby="h-check" className="rounded-card border border-line bg-surface p-4 shadow-card">
        <h2 id="h-check" className="m-0 text-[15px] font-semibold text-ink">
          Live check
        </h2>
        <p className="m-0 mt-1 text-[13px] text-ink-3">
          Each configured provider gets one short text call and one short JSON-schema call on its fast model. This spends a few tokens.
        </p>
        {checkError ? (
          <p role="alert" className="m-0 mt-3 text-[14px] text-bad">
            {checkError}
          </p>
        ) : null}
        {check ? (
          check.rows.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-[14px]">
                <caption className="sr-only">Provider check results</caption>
                <thead className="text-[12.5px] text-ink-3">
                  <tr>
                    <th scope="col" className="border-b border-line px-3 py-2 font-medium">Provider</th>
                    <th scope="col" className="border-b border-line px-3 py-2 font-medium">Model</th>
                    <th scope="col" className="border-b border-line px-3 py-2 font-medium">Text</th>
                    <th scope="col" className="border-b border-line px-3 py-2 font-medium">Schema</th>
                    <th scope="col" className="border-b border-line px-3 py-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {check.rows.map((r) => (
                    <tr key={r.provider} data-check={r.provider} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-2 font-semibold text-ink">{r.provider}</td>
                      <td className="mono px-3 py-2 text-[12.5px] text-ink-2">{r.model}</td>
                      <td className={cn('px-3 py-2 font-medium', isOk(r.text) ? 'text-ok' : 'text-bad')}>{isOk(r.text) ? 'answers' : r.text}</td>
                      <td className={cn('px-3 py-2 font-medium', isOk(r.schema) ? 'text-ok' : 'text-bad')}>{isOk(r.schema) ? 'valid JSON' : r.schema}</td>
                      <td className="mono px-3 py-2 text-[12.5px] text-ink-2">{r.ms} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="m-0 mt-3 text-[14px] text-ink-3">No provider has a key on this server, so there was nothing to check.</p>
          )
        ) : (
          <p className="m-0 mt-3 text-[14px] text-ink-3">{checking ? 'Checking the configured providers now…' : 'Not checked in this page view yet.'}</p>
        )}
        {check ? <p className="mono m-0 mt-2 text-[12px] text-ink-3">checked {new Date(check.checkedAt).toLocaleTimeString('en-GB')}</p> : null}
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-field border border-line bg-surface px-3.5 py-3">
      <p className="m-0 text-[12.5px] text-ink-3">{label}</p>
      <p className="m-0 mt-0.5 break-words text-[14.5px] font-semibold text-ink">{value}</p>
    </div>
  );
}
