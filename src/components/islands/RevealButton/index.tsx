import { useEffect } from 'preact/hooks';
import { stateFor } from './state';
import { beacon, me } from '../../../lib/me';
import { PackModal, type PackModalLabels, type Pack } from '../Checkout/PackModal';

export interface RevealLabels {
  reveal: string;
  hint: string;
  whatsapp: string;
  call: string;
  telegram: string;
  loading: string;
  error: string;
  rateLimited: string;
  balance: string;
}

interface Props {
  listingId: string;
  masked: string;
  variant: 'box' | 'sticky';
  labels: RevealLabels;
  packLabels: PackModalLabels;
  packs: Pack[];
}

export default function RevealButton({ listingId, masked, variant, labels, packLabels, packs }: Props) {
  const s = stateFor(listingId);
  useEffect(() => {
    if (variant === 'box') {
      void s.hydrate();
      beacon(listingId, 'views');
    }
  }, [listingId, variant]);

  const phase = s.phase.value;

  if (phase.kind === 'revealed') {
    const c = phase.contact;
    if (variant === 'sticky') {
      return (
        <div class="flex gap-2">
          {c.whatsappUrl && (
            <a href={c.whatsappUrl} target="_blank" rel="noopener nofollow" class="btn flex-1 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => beacon(listingId, 'wa_clicks')}>
              {labels.whatsapp}
            </a>
          )}
          <a href={`tel:${c.phone}`} class="btn-secondary flex-1">{c.phoneDisplay}</a>
        </div>
      );
    }
    return (
      <div class="space-y-2" data-revealed>
        <div class="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-center font-mono text-lg font-bold tracking-wider text-emerald-800 select-all dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">{c.phoneDisplay}</div>
        {c.whatsappUrl && (
          <a href={c.whatsappUrl} target="_blank" rel="noopener nofollow" class="btn w-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => beacon(listingId, 'wa_clicks')}>
            {labels.whatsapp}
          </a>
        )}
        <a href={`tel:${c.phone}`} class="btn-secondary w-full">{labels.call}</a>
        {c.telegramUrl && (
          <a href={c.telegramUrl} target="_blank" rel="noopener nofollow" class="btn-ghost w-full" onClick={() => beacon(listingId, 'tg_clicks')}>
            {labels.telegram}
          </a>
        )}
        {me.value && me.value.balance > 0 && <p class="text-center text-xs text-zinc-500">{labels.balance.replace('{n}', String(me.value.balance))}</p>}
      </div>
    );
  }

  const busy = phase.kind === 'loading';
  const button = (
    <button type="button" class="btn-primary w-full" disabled={busy} onClick={() => void s.reveal()} data-reveal-button>
      {busy ? labels.loading : variant === 'sticky' ? `${labels.reveal} · ${masked}` : labels.reveal}
    </button>
  );

  if (variant === 'sticky') {
    return (
      <>
        {button}
        {s.modalOpen.value && <PackModal packs={packs} labels={packLabels} listingId={listingId} balance={phase.kind === 'insufficient' ? phase.balance : 0} onClose={() => (s.modalOpen.value = false)} onPaid={() => void s.reveal()} />}
      </>
    );
  }

  return (
    <div>
      <div class="rounded-lg border border-dashed border-zinc-300 p-3 text-center font-mono text-lg tracking-wider text-zinc-500 dark:border-zinc-700">{masked}</div>
      <div class="mt-3">{button}</div>
      <p class="mt-2 text-center text-xs text-zinc-500">
        {phase.kind === 'error' ? <span class="text-red-600">{phase.message === 'rate_limited' ? labels.rateLimited : labels.error}</span> : labels.hint}
      </p>
      {s.modalOpen.value && <PackModal packs={packs} labels={packLabels} listingId={listingId} balance={phase.kind === 'insufficient' ? phase.balance : 0} onClose={() => (s.modalOpen.value = false)} onPaid={() => void s.reveal()} />}
    </div>
  );
}
