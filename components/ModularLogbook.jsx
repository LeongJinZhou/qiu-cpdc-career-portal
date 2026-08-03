import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  MapPin,
  Send,
  CheckCircle2,
  Clock,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Loader2,
  WifiOff,
  Copy,
  Check,
  X,
} from 'lucide-react';
import SupervisorMagicApproval from './SupervisorMagicApproval';
import {
  fetchLogbookEntries,
  applyCanonicalLogbookFailure,
  mergeCanonicalStudentLogbookEntries,
  submitLogbookEntry,
  submitApprovalDecision,
  updateLogbookSupervisor,
} from '@/lib/api';
import { usePortal } from './portal/PortalProvider';

const PHASE = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
};

export default function ModularLogbook({ student, activeFaculty }) {
  const assignment = activeFaculty.systemAssignment;
  const {
    identity,
    identityLoading,
    identityError,
    setStudent,
    demoMode,
  } = usePortal();

  const dbStudentId = student?.databaseId ?? null;
  const entries = student?.logbookEntries ?? [];
  const [entriesError, setEntriesError] = useState('');
  const [entriesLoading, setEntriesLoading] = useState(Boolean(demoMode));
  const liveLogbookError = student?.liveLogbookError ?? '';

  // In demo mode the server resolves the seeded student, so the logbook is fully
  // functional without a client-side database id. Under real auth we still
  // require a linked student record.
  const phase = identityLoading
    ? PHASE.LOADING
    : demoMode
      ? PHASE.READY
      : (!identity?.user?.id)
        ? PHASE.ERROR
        : (!dbStudentId)
          ? PHASE.ERROR
          : PHASE.READY;

  const loadError = !identity?.user?.id
    ? (identityError || 'Sign in is required to load your QIU identity.')
    : 'Your QIU identity does not have a linked student record for the live logbook.';

  const reloadEntries = useCallback(async () => {
    if (!demoMode && !dbStudentId) return;
    setEntriesError('');
    setEntriesLoading(true);
    try {
      const { entries: fetchedEntries } = await fetchLogbookEntries(dbStudentId);
      setStudent((previous) => ({
        ...mergeCanonicalStudentLogbookEntries(previous, fetchedEntries ?? []),
        liveLogbookError: null,
      }));
    } catch (err) {
      setEntriesError(err.message || 'Could not refresh the list.');
      setStudent((previous) => applyCanonicalLogbookFailure(previous, err.message));
    } finally {
      setEntriesLoading(false);
    }
  }, [dbStudentId, demoMode, setStudent]);

  // Load entries on mount in demo mode too (PortalProvider only auto-loads them
  // under real auth). Under real auth PortalProvider already merged them in.
  useEffect(() => {
    if (demoMode) reloadEntries();
  }, [demoMode, reloadEntries]);

  // --- Form state ---
  const [formData, setFormData] = useState({});
  const [gpsStamp, setGpsStamp] = useState(null);
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // The raw approval token only ever exists here, right after creation — it
  // is never persisted server-side, so this is the one moment it can be
  // shown for copying. Cleared on dismiss, on the next submit, or once the
  // supervisor preview records a decision.
  const [lastApproval, setLastApproval] = useState(null);
  const [copied, setCopied] = useState(false);

  const [activeMagicLog, setActiveMagicLog] = useState(null);

  // Edit-supervisor / resend state (Module 4). Keyed by the entry being edited
  // so a student who mistyped the supervisor's email can correct it and re-mint
  // the approval link without deleting and re-creating the whole entry.
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  const openEditor = (log) => {
    setEditingId(log.id);
    setEditName(log.approval?.supervisorName ?? log.supervisor ?? '');
    setEditEmail(log.approval?.supervisorEmail ?? '');
    setEditError('');
  };

  const handleResend = async (entryId) => {
    if (!editName.trim()) {
      setEditError('Supervisor name is required.');
      return;
    }
    setEditBusy(true);
    setEditError('');
    try {
      const result = await updateLogbookSupervisor(entryId, {
        name: editName.trim(),
        email: editEmail.trim() || undefined,
      });
      setEditingId(null);
      // Surface the fresh single-use link (or confirm email delivery) using the
      // same banner the initial submission uses.
      setLastApproval({
        token: result.approvalUrl ? result.approvalUrl.split('/').pop() : null,
        approvalUrl: result.approvalUrl ?? null,
        expiresAt: result.expiresAt,
        entryId,
        title: 'Updated supervisor link',
        details: '',
        hours: 0,
        supervisorName: editName.trim(),
        emailDelivered: result.emailDelivered,
      });
      setCopied(false);
      await reloadEntries();
    } catch (err) {
      setEditError(err.message || 'Could not update the supervisor. Please try again.');
    } finally {
      setEditBusy(false);
    }
  };

  const handleFieldChange = (fieldId, value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      setSubmitError('GPS is not available in this browser. You can still submit the entry without a location stamp.');
      return;
    }

    setSubmitError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGpsStamp({
          lat: coords.latitude.toFixed(4),
          lng: coords.longitude.toFixed(4),
          timestamp: new Date().toLocaleTimeString(),
        });
      },
      () => {
        setSubmitError('Location permission was not granted. You can still submit the entry without a GPS stamp.');
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 },
    );
  };

  const handleSubmitLogbook = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!demoMode && !dbStudentId) {
      setSubmitError('Your student record has not finished loading yet.');
      return;
    }
    if (!supervisorName.trim()) {
      setSubmitError('Supervisor name is required — the magic link is addressed to them.');
      return;
    }

    // Every faculty schema carries exactly one numeric field (its hours
    // question) and one textarea (its reflection/summary question); the rest
    // are free-text context. Reading the schema generically keeps this
    // working even if a faculty's field list changes shape later.
    const numberField = assignment.logFields.find((f) => f.type === 'number');
    const textareaField = assignment.logFields.find((f) => f.type === 'textarea');
    const titleField = assignment.logFields.find((f) => f.type === 'text');

    const rawHours = numberField ? formData[numberField.id] : undefined;
    const hours = parseFloat(rawHours);
    if (!numberField || rawHours === undefined || rawHours === '' || Number.isNaN(hours) || hours <= 0) {
      setSubmitError(`Enter a valid number for "${numberField?.label ?? 'hours'}".`);
      return;
    }

    const title = (titleField ? formData[titleField.id] : '') || `${activeFaculty.code} Fieldwork Entry`;
    const details = textareaField ? formData[textareaField.id] || '' : '';

    setSubmitting(true);
    try {
      const payload = {
        studentId: dbStudentId,
        title,
        details,
        hours,
        fieldValues: formData,
        supervisor: {
          name: supervisorName.trim(),
          email: supervisorEmail.trim() || undefined,
        },
        latitude: gpsStamp ? parseFloat(gpsStamp.lat) : undefined,
        longitude: gpsStamp ? parseFloat(gpsStamp.lng) : undefined,
      };

      const result = await submitLogbookEntry(payload);
      const token = result.approvalUrl ? result.approvalUrl.split('/').pop() : null;

      setLastApproval({
        token,
        approvalUrl: result.approvalUrl,
        expiresAt: result.expiresAt,
        entryId: result.entry.id,
        title,
        details,
        hours,
        supervisorName: supervisorName.trim(),
        emailDelivered: Boolean(result.emailDelivered),
      });
      setCopied(false);

      setFormData({});
      setSupervisorName('');
      setSupervisorEmail('');
      setGpsStamp(null);

      await reloadEntries();
    } catch (err) {
      setSubmitError(err.message || 'Could not submit the logbook entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyApprovalUrl = async () => {
    if (!lastApproval) return;
    try {
      await navigator.clipboard.writeText(lastApproval.approvalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked; the link text is still visible/selectable.
    }
  };

  const handlePreviewSupervisorView = () => {
    if (!lastApproval) return;
    setActiveMagicLog({
      id: lastApproval.entryId,
      date: new Date().toISOString().split('T')[0],
      hours: lastApproval.hours,
      status: 'PENDING',
      supervisor: lastApproval.supervisorName,
      title: lastApproval.title,
      details: lastApproval.details,
      approvalUrl: lastApproval.approvalUrl,
    });
  };

  // This is the real one-time approval endpoint, not a local simulator. The
  // child asks for confirmation before calling these handlers and only shows
  // success after the server accepts the token.
  const handleApproveLog = async (_logId, _signedName) => {
    const token = lastApproval?.token;
    if (token) {
      try {
        await submitApprovalDecision(token, 'APPROVED');
        setLastApproval(null);
        await reloadEntries();
        return true;
      } catch (err) {
        setSubmitError(err.message || 'Approval failed. The link is still available so you can retry.');
        return false;
      }
    }
    return false;
  };

  const handleRejectLog = async (_logId) => {
    const token = lastApproval?.token;
    if (token) {
      try {
        await submitApprovalDecision(token, 'REJECTED');
        setLastApproval(null);
        await reloadEntries();
        return true;
      } catch (err) {
        setSubmitError(err.message || 'Rejection failed. The link is still available so you can retry.');
        return false;
      }
    }
    return false;
  };

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b border-black/10 pb-6">
        <div>
          <h2 className="section-title flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-crimson" />
            <span>Fieldwork & Internship Logbook</span>
          </h2>
          <p className="section-subtitle mt-1.5">
            Right now: <span className="text-crimson font-semibold">{assignment.type}</span> for <span className="text-[#424245] font-medium">{activeFaculty.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/[0.03] border border-black/10 text-xs text-muted font-semibold whitespace-nowrap">
          <ShieldCheck className="w-4 h-4 text-crimson" />
          <span>Passwordless Magic Links Enabled</span>
        </div>
      </div>

      {phase === PHASE.LOADING && (
        <div className="surface flex flex-col items-center justify-center gap-3 py-16 text-center" role="status" aria-live="polite">
          <Loader2 className="w-8 h-8 animate-spin text-crimson" />
          <p className="text-sm text-muted">Loading your logbook…</p>
        </div>
      )}

      {phase === PHASE.ERROR && (
        <div className="surface flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
          <WifiOff className="w-10 h-10 text-muted" />
          <h3 className="font-heading font-semibold text-base text-[#1d1d1f]">Live logbook unavailable</h3>
          <p className="text-sm text-muted max-w-sm">{loadError}</p>
        </div>
      )}

      {phase === PHASE.READY && (
        <>
          {liveLogbookError && (
            <div className="surface flex items-start gap-3 border border-amber-500/30 bg-amber-50/20 p-4 text-sm text-amber-700" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">Live logbook sync needs attention</p>
                <p className="mt-1 text-xs">{liveLogbookError}</p>
              </div>
            </div>
          )}

          {/* Approval link success banner */}
          {lastApproval && (
            /* role="status" is not decoration here. This banner carries a
               SINGLE-USE approval token that is never shown again. Without a
               live region a screen-reader user submits the form, hears nothing,
               navigates away, and has permanently lost the link. */
            <div
              role="status"
              aria-live="polite"
              className="surface p-5 border-emerald-500/30 bg-emerald-50/20 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  <span>{lastApproval.emailDelivered ? `Entry submitted — approval email sent to ${lastApproval.supervisorName}` : `Entry submitted — send this link to ${lastApproval.supervisorName}`}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLastApproval(null)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted transition hover:bg-black/[0.04] hover:text-[#6e6e73]"
                  aria-label="Dismiss the supervisor approval link banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {lastApproval.emailDelivered && !lastApproval.approvalUrl ? (
                <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" /> The approval link was emailed to {lastApproval.supervisorName}.
                </p>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <code className="flex-1 text-xs text-[#6e6e73] bg-black/[0.03] border border-black/10 rounded-xl px-3.5 py-2.5 overflow-x-auto whitespace-nowrap">
                    {lastApproval.approvalUrl}
                  </code>
                  <button type="button" onClick={handleCopyApprovalUrl} className="secondary-btn text-xs py-2.5 px-3.5 whitespace-nowrap">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Link'}</span>
                  </button>
                  <button type="button" onClick={handlePreviewSupervisorView} className="secondary-btn text-xs py-2.5 px-3.5 whitespace-nowrap">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Preview Supervisor View</span>
                  </button>
                </div>
              )}
              <p className="text-[11px] text-muted">
                Single-use link, expires {new Date(lastApproval.expiresAt).toLocaleDateString()}. It will not be shown again after you leave this page.
              </p>
            </div>
          )}

          {/* Grid: Dynamic Input Form + Historical Logbook Entries */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left Side (7 Cols): Dynamic Input Form */}
            <div className="lg:col-span-7 space-y-6">
              <div className="surface p-7 space-y-6">
                <div className="border-b border-black/10 pb-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-heading font-semibold text-base text-[#1d1d1f]">Log Fieldwork / Internship Hours</h3>
                    <p className="text-xs text-muted mt-0.5">Custom schema rendered automatically for {activeFaculty.code}</p>
                  </div>

                  {/* GPS Button */}
                  <button
                    type="button"
                    onClick={handleCaptureGPS}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                      gpsStamp ? 'bg-emerald-50/60 text-emerald-700 border border-emerald-500/30' : 'secondary-btn'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{gpsStamp ? `GPS: ${gpsStamp.lat}, ${gpsStamp.lng}` : 'Check-in GPS Location'}</span>
                  </button>
                </div>

                <form onSubmit={handleSubmitLogbook} className="space-y-5">

                  {assignment.logFields.map((field) => (
                    <div key={field.id}>
                      <label htmlFor={field.id} className="block text-xs font-semibold text-muted mb-1.5">{field.label}</label>
                      {field.type === 'textarea' ? (
                        <textarea
                          id={field.id}
                          rows={3}
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full p-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition leading-relaxed"
                          required
                        />
                      ) : (
                        <input
                          id={field.id}
                          type={field.type}
                          /* The faculty log schemas render `hours` as
                             type="number". On a phone that shows the full
                             keyboard unless inputMode says otherwise, and this
                             is the most-used numeric field in the product.
                             min/step also stop "-3" or "2.7318" hours. */
                          inputMode={field.type === 'number' ? 'decimal' : undefined}
                          min={field.type === 'number' ? 0 : undefined}
                          step={field.type === 'number' ? 0.25 : undefined}
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
                          required
                        />
                      )}
                    </div>
                  ))}

                  <div className="pt-1 border-t border-black/10" />

                  <div>
                    <label htmlFor="supervisorName" className="block text-xs font-semibold text-muted mb-1.5">Supervisor Name</label>
                    <input
                      id="supervisorName"
                      type="text"
                      placeholder="Who should sign off on this entry?"
                      value={supervisorName}
                      onChange={(e) => setSupervisorName(e.target.value)}
                      className="w-full h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="supervisorEmail" className="block text-xs font-semibold text-muted mb-1.5">Supervisor Email (optional)</label>
                    <input
                      id="supervisorEmail"
                      type="email"
                      placeholder="For emailing the magic link directly"
                      value={supervisorEmail}
                      onChange={(e) => setSupervisorEmail(e.target.value)}
                      className="w-full h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
                    />
                  </div>

                  {submitError && (
                    <div className="flex items-start gap-2 rounded-[18px] border border-amber-500/30 bg-amber-50/20 p-3.5 text-xs text-amber-700" role="alert">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button type="submit" disabled={submitting} className="w-full crimson-btn justify-center text-sm py-3 disabled:opacity-60">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>{submitting ? 'Submitting…' : 'Submit Log & Generate Supervisor Magic Link'}</span>
                  </button>

                </form>
              </div>
            </div>

            {/* Right Side (5 Cols): Historical Submissions & Magic Link Approval */}
            <div className="lg:col-span-5 space-y-6">
              <div className="surface p-6 space-y-4">
                <h3 className="font-heading font-semibold text-base text-[#1d1d1f] border-b border-black/10 pb-4 flex items-center justify-between">
                  <span>Logbook Submissions ({entries.length})</span>
                  <span className="text-[10px] text-muted font-normal">Live from Postgres</span>
                </h3>

                {entriesError && (
                  <p className="text-xs text-amber-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {entriesError}
                  </p>
                )}

                {entriesLoading ? (
                  <div className="flex flex-col items-center text-center gap-2 py-10" role="status" aria-live="polite">
                    <Loader2 className="w-7 h-7 animate-spin text-crimson" />
                    <p className="text-sm text-muted">Syncing your live entries…</p>
                  </div>
                ) : entries.length === 0 ? (
                  <div className="flex flex-col items-center text-center gap-2 py-10">
                    <Sparkles className="w-8 h-8 text-muted" />
                    <p className="text-sm text-[#6e6e73] font-medium">No entries yet</p>
                    <p className="text-xs text-muted max-w-[220px]">Submit your first log on the left to see it appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entries.map((log) => (
                      <div key={log.id} className="p-4 rounded-[18px] bg-black/[0.03] border border-black/[0.06] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted">
                            LOG-{log.id.slice(-8).toUpperCase()} • {new Date(log.entryDate).toLocaleDateString()}
                          </span>
                          <span className={`badge-pill ${
                            log.status === 'APPROVED' ? 'bg-emerald-50/60 text-emerald-700 border border-emerald-500/30' :
                            log.status === 'REJECTED' ? 'bg-black/[0.03] text-muted border border-black/10' :
                            'bg-crimson/15 text-crimson border border-crimson/30'
                          }`}>
                            {log.status}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-semibold text-sm text-[#1d1d1f]">{log.title}</h4>
                          <p className="text-xs text-muted mt-1 line-clamp-2">{log.details}</p>
                          <span className="text-[11px] text-muted flex items-center gap-1.5 mt-1">
                            <Clock className="w-3 h-3" />
                            {log.approval?.supervisorName ?? 'No supervisor assigned'} ({log.hours} hrs)
                          </span>
                        </div>

                        {log.approval?.usedAt && (
                          <div className="pt-3 border-t border-black/10 text-[11px] text-muted">
                            {log.approval.decision === 'APPROVED' ? 'Approved' : 'Rejected'} on {new Date(log.approval.usedAt).toLocaleDateString()}
                            {log.approval.comment ? ` — "${log.approval.comment}"` : ''}
                          </div>
                        )}

                        {/* Correct the supervisor + resend for entries still
                            awaiting a decision (Module 4). */}
                        {log.status === 'PENDING' && !log.approval?.decision && (
                          <div className="pt-3 border-t border-black/10">
                            {editingId === log.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  placeholder="Supervisor name"
                                  className="w-full h-9 px-3 rounded-xl bg-white border border-black/10 text-xs text-[#1d1d1f] placeholder:text-black/25 focus:outline-none focus:ring-2 focus:ring-crimson/40"
                                />
                                <input
                                  type="email"
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  placeholder="Corrected supervisor email"
                                  className="w-full h-9 px-3 rounded-xl bg-white border border-black/10 text-xs text-[#1d1d1f] placeholder:text-black/25 focus:outline-none focus:ring-2 focus:ring-crimson/40"
                                />
                                {editError && (
                                  <p className="text-[11px] text-amber-700 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {editError}
                                  </p>
                                )}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleResend(log.id)}
                                    disabled={editBusy}
                                    className="crimson-btn text-[11px] py-1.5 px-3 disabled:opacity-60"
                                  >
                                    {editBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                    <span>{editBusy ? 'Sending…' : 'Update & resend link'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="secondary-btn text-[11px] py-1.5 px-3"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openEditor(log)}
                                className="text-[11px] font-semibold text-crimson hover:underline flex items-center gap-1"
                              >
                                <Send className="w-3 h-3" /> Wrong email? Edit supervisor &amp; resend
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </>
      )}

      {/* SUPERVISOR MAGIC LINK REVIEW — actions spend the real single-use token */}
      {activeMagicLog && (
        <SupervisorMagicApproval
          logEntry={activeMagicLog}
          onApprove={handleApproveLog}
          onReject={handleRejectLog}
          onClose={() => setActiveMagicLog(null)}
        />
      )}

    </div>
  );
}
