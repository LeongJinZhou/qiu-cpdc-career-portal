import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText, X, AlertCircle, ImageIcon } from 'lucide-react';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop / tap-to-browse poster uploader. No backend in this
 * prototype — the file is only ever held in component state by the parent.
 * Images get a real object-URL preview; PDFs get a filename/size card.
 */
export default function PosterUpload({ posterFile, onFileSelected, onRemove }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);

  const validateAndSet = useCallback(
    (fileList) => {
      const file = fileList && fileList[0];
      if (!file) return;

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Unsupported file type. Please upload a PNG, JPG, WEBP image or a PDF.');
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`File is too large (${formatBytes(file.size)}). Maximum size is 15 MB.`);
        return;
      }

      setError(null);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndSet(e.dataTransfer.files);
  };

  const handleBrowseChange = (e) => {
    validateAndSet(e.target.files);
    // Reset so selecting the same file again still fires onChange.
    e.target.value = '';
  };

  if (posterFile) {
    return (
      <div className="p-4 rounded-[18px] bg-black/[0.03] border border-black/10 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {posterFile.previewUrl ? (
              // Local object URL for the just-picked file — next/image cannot
              // fetch or optimise a blob: URL, so the plain tag is correct.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterFile.previewUrl}
                alt={`Preview of uploaded poster: ${posterFile.name}`}
                className="w-14 h-14 rounded-xl object-cover border border-black/10 flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-crimson/10 border border-crimson/30 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-crimson" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1d1d1f] truncate">{posterFile.name}</p>
              <p className="text-xs text-muted">{formatBytes(posterFile.size)} • {posterFile.type === 'application/pdf' ? 'PDF document' : 'Image'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove uploaded poster"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-black/[0.03] hover:bg-black/[0.06] border border-black/10 text-muted hover:text-[#1d1d1f] transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`w-full min-h-[160px] rounded-[18px] border-2 border-dashed flex flex-col items-center justify-center gap-3 p-6 text-center transition cursor-pointer ${
          isDragging ? 'border-crimson bg-crimson/5' : 'border-black/10 bg-black/[0.02] hover:bg-black/[0.04]'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-black/[0.03] border border-black/10 flex items-center justify-center">
          <UploadCloud className="w-5 h-5 text-crimson" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1d1d1f]">Drag & drop your poster here</p>
          <p className="text-xs text-muted mt-1">or tap to browse — PNG, JPG, WEBP or PDF, up to 15 MB</p>
        </div>
        <span className="secondary-btn text-xs pointer-events-none">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Choose File</span>
        </span>
      </button>

      {/* Real file input stays in the DOM and keyboard-reachable — not visually hidden with display:none tricks that break tab order, just sized to nothing off the dropzone's own click. */}
      <input
        ref={inputRef}
        id="fyp-poster-input"
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleBrowseChange}
        className="sr-only"
      />
      <label htmlFor="fyp-poster-input" className="sr-only">
        Upload final year project poster (image or PDF)
      </label>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 px-1" role="alert">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
