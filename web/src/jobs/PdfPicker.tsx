// Picks one optional PDF (a CV or a certificate). Checks type and size before sending; the server checks again.
import { FileText, Upload, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { pdfProblem } from './types';

export function PdfPicker({
  label,
  hint,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const choose = (picked: File | undefined) => {
    if (!picked) return;
    const reason = pdfProblem(picked);
    setProblem(reason);
    onChange(reason ? null : picked);
  };
  const clear = () => {
    onChange(null);
    setProblem(null);
    if (input.current) input.current.value = '';
  };

  return (
    <div className="field">
      <span className="label" id={`${id}-l`}>{label}</span>
      {file ? (
        <div className="picked">
          <FileText size={18} aria-hidden="true" />
          <span className="picked-name">{file.name}</span>
          <span className="small muted num">{Math.max(1, Math.round(file.size / 1024))} KB</span>
          <button type="button" className="btn btn-quiet btn-small" onClick={clear} aria-label={`Remove ${file.name}`}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label className="pick" htmlFor={id}>
          <Upload size={17} aria-hidden="true" />
          <span>Choose a PDF</span>
          <input
            ref={input}
            id={id}
            type="file"
            accept="application/pdf,.pdf"
            aria-labelledby={`${id}-l`}
            aria-describedby={`${id}-h`}
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>
      )}
      <span className="hint" id={`${id}-h`}>{hint}</span>
      {problem && <span className="error" role="alert">{problem}</span>}
    </div>
  );
}
