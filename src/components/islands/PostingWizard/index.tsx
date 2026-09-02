import { useMemo, useState } from 'preact/hooks';
import { actions } from 'astro:actions';
import PhotoUploader, { type UploaderLabels, type UploaderPhoto } from '../PhotoUploader/index';

export interface Option { value: string; label: string }
export interface AreaOption extends Option { cityId: string }
export interface ServiceOption extends Option { scope: string[] | null }

export interface WizardData {
  categoryId: string; cityId: string; areaId: string; title: string; description: string; age: string; gender: string;
  nationality: string; ethnicity: string; heightCm: string; bodyType: string; languages: string[]; serviceIds: string[];
  rate1h: string; rate2h: string; rateOvernight: string; incall: boolean; outcall: boolean;
  availability: { days: number[]; from: string; to: string; allDay: boolean };
  phone: string; whatsapp: string; telegram: string;
}

export interface WizardLabels {
  steps: string[]; step: string; next: string; back: string; saveDraft: string; publish: string; saving: string; saved: string; published: string; viewListing: string;
  category: string; city: string; area: string; title: string; titleHint: string; description: string; descriptionHint: string; age: string; gender: string;
  nationality: string; ethnicity: string; height: string; bodyType: string; languages: string; services: string; rate1h: string; rate2h: string; rateOvernight: string;
  incall: string; outcall: string; availability: string; allDay: string; from: string; to: string; days: string; dayNames: string[];
  phone: string; whatsapp: string; telegram: string; contactHint: string; declaration: string; declarationRequired: string; optional: string;
  errors: Record<string, string>;
  uploader: UploaderLabels;
}

interface Props {
  listingId: string | null;
  initial: WizardData;
  initialPhotos: UploaderPhoto[];
  status: string | null;
  photoLimit: number;
  options: { categories: Option[]; cities: Option[]; areas: AreaOption[]; services: ServiceOption[]; genders: Option[]; nationalities: Option[]; ethnicities: Option[]; bodyTypes: Option[]; languages: Option[] };
  labels: WizardLabels;
  viewPath: string | null;
}

const TOTAL = 6;

export default function PostingWizard({ listingId: initialId, initial, initialPhotos, status, photoLimit, options, labels, viewPath }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(initial);
  const [listingId, setListingId] = useState<string | null>(initialId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [declared, setDeclared] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(initialPhotos.length);

  const set = <K extends keyof WizardData>(key: K, value: WizardData[K]) => setData((d) => ({ ...d, [key]: value }));
  const areas = useMemo(() => options.areas.filter((a) => a.cityId === data.cityId), [options.areas, data.cityId]);
  const services = useMemo(() => options.services.filter((s) => s.scope === null || s.scope.includes(data.categoryId)), [options.services, data.categoryId]);
  const fieldError = (name: string) => (fields[name] ? <p class="mt-1 text-xs text-red-600">{fields[name]}</p> : null);

  const errText = (raw: string | undefined): string => {
    try {
      const parsed = JSON.parse(raw ?? '') as { kind?: string; fields?: Record<string, string>; limit?: number };
      if (parsed.kind === 'validation') {
        setFields(parsed.fields ?? {});
        return labels.errors.validation ?? 'validation';
      }
      return (labels.errors[parsed.kind ?? 'generic'] ?? labels.errors.generic ?? '').replace('{limit}', String(parsed.limit ?? ''));
    } catch {
      return labels.errors.generic ?? raw ?? '';
    }
  };

  const save = async (): Promise<string | null> => {
    setBusy(true);
    setError(null);
    setFields({});
    const { data: res, error } = await actions.listings.save({ id: listingId ?? undefined, data });
    setBusy(false);
    if (error || !res) {
      setError(errText(error?.message));
      return null;
    }
    setListingId(res.id);
    setNotice(labels.saved);
    if (!initialId && typeof history !== 'undefined') history.replaceState(null, '', `/dashboard/listings/${res.id}/edit/`);
    return res.id;
  };

  const publish = async () => {
    if (!declared && status !== 'active') return setError(labels.declarationRequired);
    const id = listingId ?? (await save());
    if (!id) return;
    if (listingId) {
      const saved = await save();
      if (!saved) return;
    }
    setBusy(true);
    const { data: res, error } = await actions.listings.publish({ id, declarationAccepted: declared });
    setBusy(false);
    if (error || !res) return setError(errText(error?.message));
    setDone(viewPath ?? `/dashboard/`);
  };

  const next = async () => {
    setError(null);
    if (step === 3) {
      // Contact is the last text step; persist so photos can be uploaded.
      const id = await save();
      if (!id) return;
    }
    setStep((s) => Math.min(TOTAL - 1, s + 1));
  };

  if (done) {
    return (
      <div class="card p-8 text-center">
        <p class="text-2xl">🎉</p>
        <h2 class="mt-2 text-xl font-bold">{labels.published}</h2>
        <div class="mt-4 flex justify-center gap-2">
          {viewPath && <a href={viewPath} class="btn-primary">{labels.viewListing}</a>}
          <a href="/dashboard/" class="btn-secondary">←</a>
        </div>
      </div>
    );
  }

  const input = (name: keyof WizardData, label: string, props: Record<string, unknown> = {}, hint?: string) => (
    <div>
      <label class="label" for={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} class="input" value={String(data[name] ?? '')} onInput={(e) => set(name, (e.target as HTMLInputElement).value as never)} {...props} />
      {hint && <p class="mt-1 text-xs text-zinc-500">{hint}</p>}
      {fieldError(name)}
    </div>
  );
  const select = (name: keyof WizardData, label: string, opts: Option[], allowEmpty = false) => (
    <div>
      <label class="label" for={`f-${name}`}>{label}</label>
      <select id={`f-${name}`} class="input" value={String(data[name] ?? '')} onChange={(e) => set(name, (e.target as HTMLSelectElement).value as never)}>
        {allowEmpty && <option value="">—</option>}
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {fieldError(name)}
    </div>
  );
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div class="card p-4 sm:p-6" data-wizard-step={step}>
      <div class="mb-4 flex items-center justify-between text-xs text-zinc-500">
        <span>{labels.step.replace('{n}', String(step + 1)).replace('{total}', String(TOTAL))}</span>
        <span class="font-semibold text-zinc-700 dark:text-zinc-300">{labels.steps[step]}</span>
      </div>
      <div class="mb-4 h-1 rounded bg-zinc-200 dark:bg-zinc-800"><div class="h-1 rounded bg-brand-600 transition-all" style={`width:${((step + 1) / TOTAL) * 100}%`}></div></div>

      {step === 0 && (
        <div class="grid gap-4 sm:grid-cols-2">
          {select('categoryId', labels.category, options.categories)}
          {select('cityId', labels.city, options.cities)}
          {select('areaId', labels.area, areas, true)}
        </div>
      )}
      {step === 1 && (
        <div class="grid gap-4">
          {input('title', labels.title, { maxLength: 90, required: true }, labels.titleHint)}
          <div>
            <label class="label" for="f-description">{labels.description}</label>
            <textarea id="f-description" class="input min-h-40" maxLength={4000} value={data.description} onInput={(e) => set('description', (e.target as HTMLTextAreaElement).value)} />
            <p class="mt-1 text-xs text-zinc-500">{labels.descriptionHint} ({data.description.length}/4000)</p>
            {fieldError('description')}
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            {input('age', labels.age, { type: 'number', min: 18, max: 99, required: true, inputMode: 'numeric' })}
            {select('gender', labels.gender, options.genders)}
            {select('nationality', labels.nationality, options.nationalities, true)}
            {select('ethnicity', labels.ethnicity, options.ethnicities, true)}
            {input('heightCm', labels.height, { type: 'number', min: 120, max: 230, inputMode: 'numeric' })}
            {select('bodyType', labels.bodyType, options.bodyTypes, true)}
          </div>
          <div>
            <span class="label">{labels.languages}</span>
            <div class="flex flex-wrap gap-2">
              {options.languages.map((o) => (
                <label key={o.value} class={`cursor-pointer rounded-full border px-3 py-1 text-sm ${data.languages.includes(o.value) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-zinc-300 dark:border-zinc-700'}`}>
                  <input type="checkbox" class="sr-only" checked={data.languages.includes(o.value)} onChange={() => set('languages', toggleIn(data.languages, o.value))} />{o.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
      {step === 2 && (
        <div class="grid gap-4">
          <div>
            <span class="label">{labels.services}</span>
            <div class="flex flex-wrap gap-2">
              {services.map((o) => (
                <label key={o.value} class={`cursor-pointer rounded-full border px-3 py-1 text-sm ${data.serviceIds.includes(o.value) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-zinc-300 dark:border-zinc-700'}`}>
                  <input type="checkbox" class="sr-only" checked={data.serviceIds.includes(o.value)} onChange={() => set('serviceIds', toggleIn(data.serviceIds, o.value))} />{o.label}
                </label>
              ))}
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            {input('rate1h', labels.rate1h, { type: 'number', min: 0, step: 50000, inputMode: 'numeric' })}
            {input('rate2h', labels.rate2h, { type: 'number', min: 0, step: 50000, inputMode: 'numeric' })}
            {input('rateOvernight', labels.rateOvernight, { type: 'number', min: 0, step: 50000, inputMode: 'numeric' })}
          </div>
          <div class="flex flex-col gap-2 text-sm">
            <label class="flex items-center gap-2"><input type="checkbox" checked={data.incall} onChange={(e) => set('incall', (e.target as HTMLInputElement).checked)} />{labels.incall}</label>
            <label class="flex items-center gap-2"><input type="checkbox" checked={data.outcall} onChange={(e) => set('outcall', (e.target as HTMLInputElement).checked)} />{labels.outcall}</label>
          </div>
          <div>
            <span class="label">{labels.availability}</span>
            <div class="flex flex-wrap items-center gap-3 text-sm">
              <label class="flex items-center gap-2"><input type="checkbox" checked={data.availability.allDay} onChange={(e) => set('availability', { ...data.availability, allDay: (e.target as HTMLInputElement).checked })} />{labels.allDay}</label>
              {!data.availability.allDay && (
                <>
                  <label class="flex items-center gap-1">{labels.from} <input type="time" class="input w-auto" value={data.availability.from} onInput={(e) => set('availability', { ...data.availability, from: (e.target as HTMLInputElement).value })} /></label>
                  <label class="flex items-center gap-1">{labels.to} <input type="time" class="input w-auto" value={data.availability.to} onInput={(e) => set('availability', { ...data.availability, to: (e.target as HTMLInputElement).value })} /></label>
                </>
              )}
            </div>
            <div class="mt-2 flex flex-wrap gap-1">
              {labels.dayNames.map((d, i) => (
                <label key={i} class={`cursor-pointer rounded-md border px-2 py-1 text-xs ${data.availability.days.includes(i) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-zinc-300 dark:border-zinc-700'}`}>
                  <input type="checkbox" class="sr-only" checked={data.availability.days.includes(i)} onChange={() => set('availability', { ...data.availability, days: data.availability.days.includes(i) ? data.availability.days.filter((x) => x !== i) : [...data.availability.days, i].sort() })} />{d}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
      {step === 3 && (
        <div class="grid gap-4">
          <p class="rounded-lg bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{labels.contactHint}</p>
          {input('phone', labels.phone, { type: 'tel', required: true, inputMode: 'tel', placeholder: '0812 3456 7890' })}
          {input('whatsapp', `${labels.whatsapp} (${labels.optional})`, { type: 'tel', inputMode: 'tel' })}
          {input('telegram', labels.telegram, { placeholder: '@username' })}
        </div>
      )}
      {step === 4 && <PhotoUploader listingId={listingId} initial={initialPhotos} limit={photoLimit} labels={labels.uploader} onChange={setPhotoCount} />}
      {step === 5 && (
        <div class="grid gap-4">
          <label class="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
            <input type="checkbox" class="mt-1" checked={declared} onChange={(e) => setDeclared((e.target as HTMLInputElement).checked)} data-declaration />
            <span>{labels.declaration}</span>
          </label>
          {photoCount === 0 && <p class="text-xs text-amber-700">📷 {labels.uploader.hint.replace('{limit}', String(photoLimit))}</p>}
        </div>
      )}

      {error && <p class="mt-4 rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200" role="alert">{error}</p>}
      {notice && !error && <p class="mt-4 text-xs text-emerald-600">{notice}</p>}

      <div class="mt-6 flex flex-wrap items-center justify-between gap-2">
        <button type="button" class="btn-ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>← {labels.back}</button>
        <div class="flex gap-2">
          <button type="button" class="btn-secondary" disabled={busy} onClick={() => void save()}>{busy ? labels.saving : labels.saveDraft}</button>
          {step < TOTAL - 1 ? (
            <button type="button" class="btn-primary" disabled={busy} onClick={() => void next()} data-next>{labels.next} →</button>
          ) : (
            <button type="button" class="btn-primary" disabled={busy} onClick={() => void publish()} data-publish>{busy ? labels.saving : labels.publish}</button>
          )}
        </div>
      </div>
    </div>
  );
}
