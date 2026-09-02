import { useState } from 'preact/hooks';
import { actions } from 'astro:actions';

interface Props {
  id: string;
  status: string;
  labels: { pause: string; resume: string; renew: string; remove: string; confirmRemove: string };
}

/** Pause / resume / renew / remove buttons for one listing row; reloads on success. */
export default function ListingActions({ id, status, labels }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<{ error?: { message?: string } | null }>) => {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) return setError(error.message ?? 'error');
    location.reload();
  };
  return (
    <span class="flex flex-wrap items-center gap-1">
      {status === 'active' && <button type="button" class="btn-ghost text-xs" disabled={busy} onClick={() => void run(() => actions.listings.pause({ id }))}>{labels.pause}</button>}
      {status === 'paused' && <button type="button" class="btn-secondary text-xs" disabled={busy} onClick={() => void run(() => actions.listings.publish({ id, declarationAccepted: true }))}>{labels.resume}</button>}
      {status === 'draft' && <button type="button" class="btn-secondary text-xs" disabled={busy} onClick={() => void run(() => actions.listings.publish({ id, declarationAccepted: true }))}>{labels.resume}</button>}
      {(status === 'active' || status === 'expired') && <button type="button" class="btn-secondary text-xs" disabled={busy} onClick={() => void run(() => actions.listings.renew({ id }))} data-renew>{labels.renew}</button>}
      <button type="button" class="btn-ghost text-xs text-red-600" disabled={busy} onClick={() => confirm(labels.confirmRemove) && void run(() => actions.listings.remove({ id }))}>{labels.remove}</button>
      {error && <span class="text-xs text-red-600">{error}</span>}
    </span>
  );
}
