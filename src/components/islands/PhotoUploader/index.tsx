import { useState } from 'preact/hooks';
import { actions } from 'astro:actions';

export interface UploaderPhoto {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface UploaderLabels {
  hint: string;
  needSave: string;
  upload: string;
  uploading: string;
  remove: string;
  cover: string;
  error: string;
}

interface Props {
  listingId: string | null;
  initial: UploaderPhoto[];
  limit: number;
  labels: UploaderLabels;
  onChange?: (count: number) => void;
}

/** Downscale on the client so uploads are small and fast; the server still validates and re-encodes. */
const downscale = async (file: File, maxEdge = 2000): Promise<Blob> => {
  if (!('createImageBitmap' in window)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.86));
  } catch {
    return file;
  }
};

export default function PhotoUploader({ listingId, initial, limit, labels, onChange }: Props) {
  const [photos, setPhotos] = useState<UploaderPhoto[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const update = (next: UploaderPhoto[]) => {
    setPhotos(next);
    onChange?.(next.length);
  };

  const upload = async (files: FileList | null) => {
    if (!files || !listingId) return;
    setError(null);
    for (const file of Array.from(files).slice(0, limit - photos.length)) {
      setBusy(file.name);
      const blob = await downscale(file);
      const form = new FormData();
      form.set('listingId', listingId);
      form.set('file', blob, file.name.replace(/\.[^.]+$/, '') + '.jpg');
      const res = await fetch('/api/photos/upload', { method: 'POST', body: form, credentials: 'same-origin' });
      const json = (await res.json().catch(() => ({}))) as { id?: string; url?: string; width?: number; height?: number; error?: string };
      if (!res.ok || !json.id) {
        setError(labels.error.replace('{reason}', json.error ?? String(res.status)));
        break;
      }
      update([...photos, { id: json.id, url: json.url!, width: json.width!, height: json.height! }]);
      photos.push({ id: json.id, url: json.url!, width: json.width!, height: json.height! });
    }
    setBusy(null);
  };

  const remove = async (id: string) => {
    if (!listingId) return;
    const { error } = await actions.photos.delete({ listingId, photoId: id });
    if (!error) update(photos.filter((p) => p.id !== id));
  };

  const move = async (from: number, to: number) => {
    if (!listingId || from === to || to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    update(next);
    await actions.photos.reorder({ listingId, orderedIds: next.map((p) => p.id) });
  };

  if (!listingId) return <p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{labels.needSave}</p>;

  return (
    <div>
      <p class="text-xs text-zinc-500">{labels.hint.replace('{limit}', String(limit))}</p>
      <ul class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" onDragOver={(e) => e.preventDefault()}>
        {photos.map((p, i) => (
          <li
            key={p.id}
            class={`group relative aspect-[3/4] overflow-hidden rounded-lg border bg-zinc-100 dark:bg-zinc-800 ${dragging === p.id ? 'opacity-50' : ''} ${i === 0 ? 'border-brand-500' : 'border-zinc-200 dark:border-zinc-700'}`}
            draggable
            onDragStart={() => setDragging(p.id)}
            onDragEnd={() => setDragging(null)}
            onDrop={(e) => {
              e.preventDefault();
              const from = photos.findIndex((x) => x.id === dragging);
              if (from >= 0) void move(from, i);
              setDragging(null);
            }}
          >
            <img src={p.url} alt="" class="h-full w-full object-cover" loading="lazy" />
            {i === 0 && <span class="absolute left-1 top-1 badge bg-brand-600 text-white">{labels.cover}</span>}
            <div class="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1 text-xs text-white">
              <span>
                <button type="button" class="px-1 disabled:opacity-30" disabled={i === 0} onClick={() => void move(i, i - 1)} aria-label="←">←</button>
                <button type="button" class="px-1 disabled:opacity-30" disabled={i === photos.length - 1} onClick={() => void move(i, i + 1)} aria-label="→">→</button>
              </span>
              <button type="button" class="px-1 hover:text-red-300" onClick={() => void remove(p.id)}>{labels.remove}</button>
            </div>
          </li>
        ))}
        {photos.length < limit && (
          <li class="aspect-[3/4]">
            <label class="flex h-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-center text-sm text-zinc-500 hover:border-brand-400 dark:border-zinc-700">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="sr-only" disabled={busy !== null} onChange={(e) => void upload((e.target as HTMLInputElement).files)} data-photo-input />
              <span class="text-2xl">＋</span>
              <span>{busy ? labels.uploading : labels.upload}</span>
              <span class="text-xs text-zinc-400">{photos.length}/{limit}</span>
            </label>
          </li>
        )}
      </ul>
      {error && <p class="mt-2 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
