import { useState } from 'preact/hooks';
import { actions } from 'astro:actions';

interface Props {
  listingId: string;
  labels: { open: string; rating: string; body: string; submit: string; thanks: string; error: string; already: string };
}

export default function ReviewForm({ listingId, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error' | 'already'>('idle');

  const submit = async (e: Event) => {
    e.preventDefault();
    setState('busy');
    const { error } = await actions.reviews.create({ listingId, rating, body });
    setState(error ? (error.message === 'already' ? 'already' : 'error') : 'done');
  };

  if (!open) return <button type="button" class="btn-secondary mt-3 text-xs" onClick={() => setOpen(true)} data-review-button>{labels.open}</button>;
  if (state === 'done') return <p class="mt-3 text-sm text-emerald-700">{labels.thanks}</p>;
  return (
    <form onSubmit={submit} class="card mt-3 p-3" data-review-form>
      <span class="label">{labels.rating}</span>
      <div class="flex gap-1 text-2xl" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} class={n <= rating ? 'text-gold-500' : 'text-zinc-300'} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      <label class="label mt-2" for="review-body">{labels.body}</label>
      <textarea id="review-body" class="input min-h-24" minLength={10} maxLength={1000} required value={body} onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)} />
      {state === 'error' && <p class="mt-2 text-sm text-red-600">{labels.error}</p>}
      {state === 'already' && <p class="mt-2 text-sm text-amber-700">{labels.already}</p>}
      <button type="submit" class="btn-primary mt-3" disabled={state === 'busy' || body.trim().length < 10}>{labels.submit}</button>
    </form>
  );
}
