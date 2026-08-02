import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  PenTool, 
} from 'lucide-react';

export default function SupervisorMagicApproval({ logEntry, onApprove, onReject, onClose }) {
  const [signedName, setSignedName] = useState(logEntry.supervisor || 'Dr. Marcus Vance');
  const [status, setStatus] = useState(logEntry.status || 'PENDING');
  const [actionDone, setActionDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirmApprove = async () => {
    if (!window.confirm('This is the real one-time approval link. Approving will save the decision to the QIU logbook and cannot be undone from this screen. Continue?')) return;
    setBusy(true);
    const accepted = await onApprove(logEntry.id, signedName);
    setBusy(false);
    if (accepted) {
      setActionDone(true);
      setStatus('APPROVED');
    }
  };

  const handleConfirmReject = async () => {
    if (!window.confirm('This is the real one-time approval link. Rejecting will save the decision to the QIU logbook. Continue?')) return;
    setBusy(true);
    const accepted = await onReject(logEntry.id);
    setBusy(false);
    if (accepted) {
      setActionDone(true);
      setStatus('REJECTED');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-lg flex items-center justify-center p-4" role="presentation">
      
      {/* Phone Frame Mockup */}
      <div className="bg-surface border border-black/10 rounded-[36px] max-w-sm w-full max-h-[calc(100vh-2rem)] overflow-y-auto p-6 space-y-6 shadow-lg relative text-left" role="dialog" aria-modal="true" aria-labelledby="magic-link-heading">

        {/* Phone Speaker Notch */}
        <div className="w-28 h-4 bg-black/[0.03] rounded-full mx-auto mb-1 flex items-center justify-center">
          <div className="w-8 h-1 bg-black/[0.08] rounded-full"></div>
        </div>

        {/* Banner */}
        <div className="p-4 rounded-[18px] bg-black/[0.03] border border-black/10 text-center space-y-1.5">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-crimson">
            <ShieldCheck className="w-4 h-4" />
            <span id="magic-link-heading">QIU Supervisor Magic Link</span>
          </div>
          <p className="text-xs text-muted">Passwordless, one-time approval link. This decision is saved to the QIU logbook.</p>
        </div>

        {actionDone ? (
          <div className="py-10 text-center space-y-3">
            {status === 'APPROVED' ? (
              <>
                <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto animate-bounce" />
                <h3 className="text-xl font-heading font-semibold text-[#1d1d1f]">Logbook Approved</h3>
                <p className="text-sm text-muted px-2">The approval decision was saved to the QIU logbook.</p>
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 text-muted mx-auto" />
                <h3 className="text-xl font-heading font-semibold text-[#1d1d1f]">Logbook Rejected</h3>
                <p className="text-sm text-muted px-2">The rejection decision was saved. The student can revise the entry and send a new link.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-5">

            {/* Student Info */}
            <div className="space-y-1.5 border-b border-black/10 pb-4">
              <span className="text-[10px] uppercase font-bold text-muted tracking-wider">Student Submission</span>
              <h3 className="font-heading font-semibold text-lg text-[#1d1d1f] leading-snug">{logEntry.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted">
                <Clock className="w-4 h-4" />
                <span>{logEntry.hours} Logged Shift Hours ({logEntry.date})</span>
              </div>
            </div>

            {/* Log Details */}
            <div className="bg-black/[0.03] p-4 rounded-[18px] border border-black/[0.06] space-y-2 text-sm">
              <span className="text-[10px] text-muted font-semibold block uppercase tracking-wider">Activity Details</span>
              <p className="text-[#424245] leading-relaxed">{logEntry.details}</p>
            </div>

            {/* Only show a location if the submitted entry actually contains one. */}
            <div className="p-3 rounded-[18px] bg-black/[0.03] border border-black/10 flex items-center justify-between text-xs text-muted gap-2">
              <span className="flex items-center gap-1.5 font-semibold"><MapPin className="w-4 h-4" /> Location record</span>
              {Number.isFinite(Number(logEntry.latitude)) && Number.isFinite(Number(logEntry.longitude)) ? <span className="font-mono text-[10px]">{Number(logEntry.latitude).toFixed(4)}, {Number(logEntry.longitude).toFixed(4)}</span> : <span>Not recorded</span>}
            </div>

            {/* Signature Box */}
            <div>
              <label htmlFor="supervisor-signature" className="text-xs font-semibold text-muted mb-1.5 flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5" />
                External Supervisor Name & Title
              </label>
              <input
                id="supervisor-signature"
                type="text"
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                className="w-full h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
              />
            </div>

            {/* Action Buttons — large, unmistakable, thumb-friendly */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleConfirmReject}
                disabled={busy}
                className="w-full py-3.5 rounded-[18px] bg-black/[0.03] text-[#6e6e73] border border-black/10 text-sm font-bold hover:bg-black/[0.06] transition flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-5 h-5" />
                <span>Reject</span>
              </button>

              <button
                onClick={handleConfirmApprove}
                disabled={busy}
                className="w-full py-3.5 rounded-[18px] bg-crimson text-white text-sm font-bold hover:bg-[var(--crimson-hover)] transition shadow-[0_4px_20px_var(--crimson-glow)] flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{busy ? 'Saving…' : 'Approve and save'}</span>
              </button>
            </div>

          </div>
        )}

        <div className="pt-1 text-center">
          <button type="button" onClick={onClose} aria-label="Close supervisor approval preview" className="text-xs text-muted hover:text-[#6e6e73] underline transition">
            Close real approval review
          </button>
        </div>

      </div>
    </div>
  );
}
