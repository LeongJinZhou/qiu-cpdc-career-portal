'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { checkInCodeFor } from './eventCatalogue';

/**
 * Attendance check-in — the highest-frequency action in the platform (§9.2), so
 * this screen is deliberately the lightest one in the module: no confetti, no
 * camera emulation, no timers on the success path. Enter the code shown at the
 * venue, tap once, done. Attendance is written immediately and the XP / CV /
 * Career Path updates follow from the same state write.
 *
 * Honest by design: the platform has no QR encoder, so nothing here pretends to
 * be a scannable QR code. The venue shows a six-digit code; the student types
 * it. When a real encoder is added, this component gains a scan button and the
 * typed code stays as the fallback.
 */
export default function CheckInSheet({ event, onConfirm, onClose }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);
  const expected = checkInCodeFor(event);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    if (done) return;
    if (code.trim() !== expected) {
      setError('That code does not match this event. Check the screen at the venue.');
      return;
    }
    // Optimistic: mark it done in the same tick the student taps.
    setDone(true);
    setError('');
    onConfirm?.(event);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
        className="surface w-full max-w-md space-y-5 rounded-b-none rounded-t-3xl p-6 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="checkin-title" className="font-heading text-lg font-semibold text-[#1d1d1f]">
              {done ? 'Attendance recorded' : 'Check in'}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{event.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close check-in"
            className="-m-2 flex h-11 w-11 items-center justify-center rounded-full text-muted transition hover:text-[#1d1d1f]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[18px] border border-emerald-500/30 bg-emerald-50/60 p-4">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-700" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  +{event.xpReward} XP added
                </p>
                <p className="text-xs text-emerald-700">
                  Logged to your record, CV and Career Path checklist straight away.
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="crimson-btn min-h-[44px] w-full justify-center text-sm">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label htmlFor="checkin-code" className="block text-xs font-semibold text-muted">
              Six-digit code shown at the venue
            </label>
            <input
              id="checkin-code"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="000000"
              aria-describedby={error ? 'checkin-error' : 'checkin-hint'}
              className="w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 py-4 text-center font-mono text-3xl tracking-[0.4em] text-[#1d1d1f] placeholder:text-black/40 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
            />

            {error && (
              <p id="checkin-error" role="alert" className="text-xs font-semibold text-crimson">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={code.length !== 6}
              className={`crimson-btn min-h-[52px] w-full justify-center text-base ${code.length !== 6 ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              Confirm attendance
            </button>

            <p id="checkin-hint" className="text-center text-[11px] text-muted">
              Prototype demo — this event&apos;s venue code is{' '}
              <button
                type="button"
                onClick={() => { setCode(expected); setError(''); }}
                className="font-mono font-semibold text-[#1d1d1f] underline"
              >
                {expected}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
