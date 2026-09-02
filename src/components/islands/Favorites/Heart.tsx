import { useEffect, useState } from 'preact/hooks';
import { actions } from 'astro:actions';
import { loadMe, me } from '../../../lib/me';

interface Props {
  listingId: string;
  labels: { save: string; saved: string };
  class?: string;
}

/** Heart toggle; reads the initial state from /api/me, persists via action. */
export default function Heart({ listingId, labels, class: cls = '' }: Props) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void loadMe();
  }, []);
  const favorited = me.value?.favoriteIds.includes(listingId) ?? false;
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const { data } = await actions.favorites.toggle({ listingId });
    if (data && me.value) {
      const ids = data.favorited ? [...me.value.favoriteIds, listingId] : me.value.favoriteIds.filter((id) => id !== listingId);
      me.value = { ...me.value, favoriteIds: ids };
    } else if (data) {
      await loadMe(true);
    }
    setBusy(false);
  };
  return (
    <button type="button" class={`inline-flex items-center gap-1 ${favorited ? 'text-brand-600' : 'text-zinc-500 hover:text-brand-600'} ${cls}`} onClick={() => void toggle()} aria-pressed={favorited} data-favorite-button>
      <span aria-hidden="true">{favorited ? '♥' : '♡'}</span> {favorited ? labels.saved : labels.save}
    </button>
  );
}
