import { useState } from 'preact/hooks';
import { startCheckout, type CheckoutLabels } from './checkout';

export interface Pack {
  code: string;
  name: string;
  credits: number;
  priceLabel: string;
  perRevealLabel: string;
  popular?: boolean;
}

export interface PackModalLabels extends CheckoutLabels {
  title: string;
  subtitle: string;
  buy: string;
  close: string;
  secure: string;
}

interface Props {
  packs: Pack[];
  labels: PackModalLabels;
  listingId: string;
  balance: number;
  onClose: () => void;
  onPaid: () => void;
}

export function PackModal({ packs, labels, listingId, onClose, onPaid }: Props) {
  const [selected, setSelected] = useState(packs.find((p) => p.popular)?.code ?? packs[0]?.code ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buy = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const result = await startCheckout({ productCode: selected, listingId, labels });
    setBusy(false);
    if (result === 'paid') onPaid();
    else if (result !== 'closed') setError(result);
  };

  return (
    <div class="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="card w-full max-w-md rounded-b-none p-5 sm:rounded-b-xl">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-bold">{labels.title}</h2>
            <p class="mt-1 text-sm text-zinc-500">{labels.subtitle}</p>
          </div>
          <button type="button" class="btn-ghost -mr-2 -mt-2" onClick={onClose} aria-label={labels.close}>✕</button>
        </div>
        <div class="mt-4 space-y-2">
          {packs.map((p) => (
            <label key={p.code} class={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${selected === p.code ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-zinc-200 dark:border-zinc-700'}`}>
              <span class="flex items-center gap-3">
                <input type="radio" name="pack" value={p.code} checked={selected === p.code} onChange={() => setSelected(p.code)} />
                <span>
                  <span class="font-semibold">{p.name}</span>
                  {p.popular && <span class="badge ml-2 bg-brand-600 text-white">★</span>}
                  <span class="block text-xs text-zinc-500">{p.perRevealLabel}</span>
                </span>
              </span>
              <span class="font-bold">{p.priceLabel}</span>
            </label>
          ))}
        </div>
        {error && <p class="mt-3 text-sm text-red-600">{error}</p>}
        <button type="button" class="btn-primary mt-4 w-full" disabled={busy || !selected} onClick={() => void buy()}>
          {busy ? '…' : labels.buy}
        </button>
        <p class="mt-2 text-center text-[11px] text-zinc-400">{labels.secure}</p>
      </div>
    </div>
  );
}
