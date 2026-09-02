import { useState } from 'preact/hooks';
import { actions } from 'astro:actions';

interface Props { initialName: string; labels: { name: string; save: string; saved: string } }

export default function ProfileForm({ initialName, labels }: Props) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await actions.auth.updateProfile({ displayName: name });
    setBusy(false);
    setSaved(!error);
  };
  return (
    <form onSubmit={submit} class="flex items-end gap-2">
      <div class="flex-1">
        <label class="label" for="display-name">{labels.name}</label>
        <input id="display-name" class="input" maxLength={40} value={name} onInput={(e) => { setName((e.target as HTMLInputElement).value); setSaved(false); }} />
      </div>
      <button type="submit" class="btn-primary" disabled={busy}>{labels.save}</button>
      {saved && <span class="text-sm text-emerald-600">{labels.saved}</span>}
    </form>
  );
}
