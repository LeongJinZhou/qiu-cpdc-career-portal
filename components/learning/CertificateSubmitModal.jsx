'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, FileUp, Link2, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { PROVIDERS } from '@/lib/data/courses';

/**
 * Completion sync, kept to two taps: the course is already chosen (the card the
 * student tapped), so all that remains is attach evidence and submit.
 *
 * A student can never mark their own certificate verified. This dialog only
 * produces a submission; the decision belongs to CPDC (or to the platform-wide
 * approval policy an admin configured in Settings).
 */
export default function CertificateSubmitModal({ course, autoApprove = false, onClose, onSubmit }) {
  const [mode, setMode] = useState('link'); // 'link' | 'file'
  const [link, setLink] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState('');
  const [error, setError] = useState('');
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!course) return null;

  const providerLabel = PROVIDERS[course.provider]?.label ?? course.provider;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mode === 'link') {
      const value = link.trim();
      if (!/^https?:\/\/\S+\.\S+/.test(value)) {
        setError('Paste the full verification URL from your certificate, starting with https://');
        return;
      }
      onSubmit({ type: 'link', value });
      return;
    }

    if (!fileName || !fileData) {
      setError('Choose the certificate file you downloaded from the provider.');
      return;
    }
    onSubmit({ type: 'file', value: fileName, data: fileData });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" role="presentation">
      <div
        className="surface w-full max-w-md space-y-5 rounded-3xl p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-submit-heading"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="cert-submit-heading" className="font-heading text-lg font-semibold text-[#1d1d1f]">
              Submit your certificate
            </h3>
            <p className="mt-1 text-sm text-muted">{course.title}</p>
            <p className="text-xs text-muted">{providerLabel} · {course.taughtBy}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close certificate submission"
            className="-m-2 p-2 text-muted transition hover:text-[#1d1d1f]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted">How do you want to prove it?</span>
            <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-black/[0.03] p-1" role="radiogroup" aria-label="Evidence type">
              {[
                { id: 'link', label: 'Verified link', icon: Link2 },
                { id: 'file', label: 'Upload file', icon: FileUp },
              ].map((option) => {
                const Icon = option.icon;
                const active = mode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => { setMode(option.id); setError(''); }}
                    className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
                      active ? 'bg-crimson text-white' : 'text-muted hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {mode === 'link' ? (
            <div>
              <label htmlFor="cert-link" className="mb-1.5 block text-xs font-semibold text-muted">
                Certificate verification URL
              </label>
              <input
                id="cert-link"
                type="url"
                inputMode="url"
                value={link}
                onChange={(event) => { setLink(event.target.value); setError(''); }}
                placeholder="https://coursera.org/verify/..."
                className="h-11 w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 text-sm text-[#1d1d1f] transition placeholder:text-black/20 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
              />
              <p className="mt-1.5 text-[11px] text-muted">
                Providers publish a shareable verification page for each certificate — paste that link.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="cert-file" className="mb-1.5 block text-xs font-semibold text-muted">
                Certificate file (PDF or image)
              </label>
              <input
                id="cert-file"
                type="file"
                accept=".pdf,image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setFileName(file?.name ?? '');
                  setFileData('');
                  if (file && file.size > 2_500_000) {
                    setError('Choose a certificate file smaller than 2.5 MB.');
                    return;
                  }
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setFileData(String(reader.result ?? ''));
                    reader.onerror = () => setError('The certificate file could not be read.');
                    reader.readAsDataURL(file);
                  }
                  setError('');
                }}
                className="block w-full rounded-[18px] border border-black/10 bg-black/[0.04] p-3 text-xs text-muted file:mr-3 file:min-h-[36px] file:rounded-full file:border-0 file:bg-crimson file:px-4 file:text-xs file:font-semibold file:text-white"
              />
              {fileName && <p className="mt-1.5 text-[11px] font-medium text-[#6e6e73]">Selected: {fileName}</p>}
            </div>
          )}

          {error && (
            <p className="flex items-start gap-1.5 text-xs font-semibold text-crimson" role="alert">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <p className="flex items-start gap-2 rounded-[14px] border border-black/[0.06] bg-black/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {autoApprove
                ? 'CPDC has set course approvals to automatic, so this is checked against the provider record and cleared without a queue. You are not verifying it yourself.'
                : 'Your submission goes to CPDC as Pending verification. Only a CPDC officer or faculty coordinator can approve it — XP, the badge and the CV line appear after that.'}
            </span>
          </p>

          <button type="submit" className="crimson-btn min-h-[44px] w-full justify-center text-sm">
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            <span>Submit for verification</span>
          </button>
        </form>
      </div>
    </div>
  );
}
