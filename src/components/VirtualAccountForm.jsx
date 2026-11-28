import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';

/** Create the student's Moniepoint virtual account (Monnify needs a BVN or NIN; never stored by LodgeMart). */
export default function VirtualAccountForm({ onDone }) {
  const { createVirtualAccount } = useLodgeMart();
  const [kind, setKind] = useState('bvn');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await createVirtualAccount({ [kind]: value.trim() });
    setBusy(false);
    if (!res.ok) {
      setError(res.details?.[0]?.message || res.error);
      return;
    }
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border-2 border-ink/10 bg-white p-4">
      <p className="text-sm text-muted">
        Monnify (Moniepoint) needs your <strong>BVN or NIN</strong> to open your personal wallet account. LodgeMart passes
        it to Monnify and never stores it.
      </p>
      <div className="flex gap-2">
        {['bvn', 'nin'].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`h-9 rounded px-3 font-display text-xs uppercase tracking-[0.12em] cursor-pointer ${kind === k ? 'bg-ink text-white' : 'bg-tile text-ink'}`}
          >
            {k}
          </button>
        ))}
      </div>
      <input
        inputMode="numeric"
        maxLength={11}
        required
        pattern="\d{11}"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        placeholder={`11-digit ${kind.toUpperCase()}`}
        className="h-11 w-full rounded-md border-2 border-ink/10 px-3 font-display tracking-[0.2em] text-ink focus:border-accent-500 focus:outline-none"
      />
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy || value.length !== 11}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink font-display text-xs uppercase tracking-[0.14em] text-white transition-colors hover:bg-accent-500 hover:text-ink disabled:opacity-50 cursor-pointer"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create my account number
      </button>
    </form>
  );
}
