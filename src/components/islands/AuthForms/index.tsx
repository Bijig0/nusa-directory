import { useState } from 'preact/hooks';
import { actions } from 'astro:actions';

export interface AuthLabels {
  tabWa: string; tabEmail: string; phoneLabel: string; phonePlaceholder: string; emailLabel: string; emailPlaceholder: string;
  sendCode: string; codeTitle: string; codeSent: string; codeLabel: string; verify: string; resend: string; change: string; devCode: string;
  errors: Record<string, string>;
}

interface Props {
  labels: AuthLabels;
  next: string;
  /** Link mode: attach a new identity to the signed-in account instead of signing in. */
  link?: boolean;
  initialChannel?: 'wa' | 'email';
}

type Step = { kind: 'request' } | { kind: 'verify'; otpId: string; destination: string; channel: 'wa' | 'email'; devCode?: string };

export default function AuthForms({ labels, next, link = false, initialChannel = 'wa' }: Props) {
  const [channel, setChannel] = useState<'wa' | 'email'>(initialChannel);
  const [destination, setDestination] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'request' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errText = (key: string | undefined) => labels.errors[key ?? 'generic'] ?? labels.errors.generic ?? key ?? '';

  const request = async (e?: Event) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await actions.auth.requestOtp({ channel, destination, link });
    setBusy(false);
    if (error || !data) return setError(errText(error?.message));
    setCode('');
    setStep({ kind: 'verify', otpId: data.otpId, destination: data.destination, channel: data.channel, devCode: data.devCode });
  };

  const verify = async (e: Event) => {
    e.preventDefault();
    if (step.kind !== 'verify') return;
    setBusy(true);
    setError(null);
    const { data, error } = await actions.auth.verifyOtp({ otpId: step.otpId, code, next });
    setBusy(false);
    if (error || !data) return setError(errText(error?.message));
    location.href = data.redirect;
  };

  if (step.kind === 'verify') {
    return (
      <form onSubmit={verify} class="space-y-3" data-step="verify">
        <h2 class="text-lg font-bold">{labels.codeTitle}</h2>
        <p class="text-sm text-zinc-500">{labels.codeSent.replace('{destination}', step.destination)}</p>
        {step.devCode && <p class="rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" data-dev-code={step.devCode}>{labels.devCode.replace('{code}', step.devCode)}</p>}
        <label class="label" for="otp-code">{labels.codeLabel}</label>
        <input id="otp-code" class="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value.replace(/\D/g, ''))} autoFocus />
        {error && <p class="text-sm text-red-600" role="alert">{error}</p>}
        <button type="submit" class="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? '…' : labels.verify}</button>
        <div class="flex justify-between text-xs">
          <button type="button" class="text-brand-600 hover:underline" onClick={() => void request()} disabled={busy}>{labels.resend}</button>
          <button type="button" class="text-zinc-500 hover:underline" onClick={() => setStep({ kind: 'request' })}>{labels.change}</button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={request} class="space-y-3" data-step="request">
      {!link && (
        <div class="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800" role="tablist">
          {(['wa', 'email'] as const).map((c) => (
            <button key={c} type="button" role="tab" aria-selected={channel === c} class={`rounded-md py-1.5 font-medium ${channel === c ? 'bg-white shadow dark:bg-zinc-900' : 'text-zinc-500'}`} onClick={() => setChannel(c)}>
              {c === 'wa' ? labels.tabWa : labels.tabEmail}
            </button>
          ))}
        </div>
      )}
      <label class="label" for="auth-destination">{channel === 'wa' ? labels.phoneLabel : labels.emailLabel}</label>
      <input
        id="auth-destination" class="input" required autoFocus
        type={channel === 'wa' ? 'tel' : 'email'} inputMode={channel === 'wa' ? 'tel' : 'email'} autoComplete={channel === 'wa' ? 'tel' : 'email'}
        placeholder={channel === 'wa' ? labels.phonePlaceholder : labels.emailPlaceholder} value={destination}
        onInput={(e) => setDestination((e.target as HTMLInputElement).value)}
      />
      {error && <p class="text-sm text-red-600" role="alert">{error}</p>}
      <button type="submit" class="btn-primary w-full" disabled={busy || destination.length < 5}>{busy ? '…' : labels.sendCode}</button>
    </form>
  );
}
