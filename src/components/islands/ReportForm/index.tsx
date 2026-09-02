import { useState } from 'preact/hooks';
import { actions } from 'astro:actions';

interface Props {
  listingId: string;
  reasons: { value: string; label: string }[];
  labels: { open: string; title: string; reason: string; details: string; submit: string; thanks: string; error: string; cancel: string };
}

export default function ReportForm({ listingId, reasons, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]?.value ?? 'other');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  const submit = async (e: Event) => {
    e.preventDefault();
    setState('busy');
    const { error } = await actions.reports.create({ listingId, reason: reason as never, details: details || undefined });
    setState(error ? 'error' : 'done');
  };

  if (!open) return <button type="button" class="text-zinc-500 hover:text-red-600" onClick={() => setOpen(true)} data-report-button>{labels.open}</button>;
  return (
    <div class="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <form onSubmit={submit} class="card w-full max-w-md rounded-b-none p-5 sm:rounded-b-xl" data-report-form>
        <h2 class="text-lg font-bold">{labels.title}</h2>
        {state === 'done' ? (
          <p class="mt-3 text-sm text-emerald-700">{labels.thanks}</p>
        ) : (
          <>
            <label class="label mt-3" for="report-reason">{labels.reason}</label>
            <select id="report-reason" class="input" value={reason} onChange={(e) => setReason((e.target as HTMLSelectElement).value)}>
              {reasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <label class="label mt-3" for="report-details">{labels.details}</label>
            <textarea id="report-details" class="input min-h-24" maxLength={1000} value={details} onInput={(e) => setDetails((e.target as HTMLTextAreaElement).value)} />
            {state === 'error' && <p class="mt-2 text-sm text-red-600">{labels.error}</p>}
          </>
        )}
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="btn-ghost" onClick={() => setOpen(false)}>{labels.cancel}</button>
          {state !== 'done' && <button type="submit" class="btn-primary" disabled={state === 'busy'}>{labels.submit}</button>}
        </div>
      </form>
    </div>
  );
}
