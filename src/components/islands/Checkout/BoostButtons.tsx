import { useState } from 'preact/hooks';
import { startCheckout, type CheckoutLabels } from './checkout';

export interface BoostOffer {
  code: string;
  name: string;
  description: string;
  priceLabel: string;
}

interface Props {
  listingId: string;
  offers: BoostOffer[];
  labels: CheckoutLabels & { buy: string; done: string; back: string };
}

export default function BoostButtons({ listingId, offers, labels }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const buy = async (code: string) => {
    setBusy(code);
    setMessage(null);
    const result = await startCheckout({ productCode: code, listingId, labels });
    setBusy(null);
    if (result === 'paid') setDone(true);
    else if (result !== 'closed') setMessage(result);
  };

  if (done) {
    return (
      <div class="card p-6 text-center">
        <p class="text-lg font-bold">✨ {labels.done}</p>
        <a href="/dashboard/" class="btn-primary mt-4">{labels.back}</a>
      </div>
    );
  }

  return (
    <div class="grid gap-3 sm:grid-cols-3">
      {offers.map((o) => (
        <div key={o.code} class={`card flex flex-col p-4 ${o.code === 'vip_30d' ? 'border-gold-500' : ''}`} data-boost={o.code}>
          <h3 class="font-bold">{o.name}</h3>
          <p class="mt-1 flex-1 text-xs text-zinc-500">{o.description}</p>
          <p class="mt-3 text-xl font-black">{o.priceLabel}</p>
          <button type="button" class="btn-primary mt-3 w-full" disabled={busy !== null} onClick={() => void buy(o.code)}>{busy === o.code ? '…' : labels.buy}</button>
        </div>
      ))}
      {message && <p class="text-sm text-red-600 sm:col-span-3">{message}</p>}
    </div>
  );
}
