import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { 
  Calendar, 
  Sparkles, 
  QrCode, 
  MapPin, 
  Clock, 
  UserCheck, 
  BookOpen,
  ExternalLink, 
  CheckCircle2, 
  Award,
  PlusCircle,
  Camera,
  X
} from 'lucide-react';
import { WORKSHOPS, ONLINE_COURSES } from '@/lib/data/facultyData';
import { useSettings } from '@/lib/settings';
import { workshopMatch } from '@/lib/matching';
import {
  fetchWorkshops,
  publishWorkshop,
  rsvpWorkshop,
  checkInWorkshop,
} from '@/lib/api';
import { emitXpUpdated } from '@/lib/xp-events';
import DismissibleDialog from '@/components/ui/DismissibleDialog';
import { useAccessibleTabs } from '@/components/ui/useAccessibleTabs';

// The workshops API returns DB rows; the card + matcher expect the registry's
// display shape. This adapts one to the other so published events, RSVPs and
// attendance all read from Postgres rather than resetting on refresh.
function formatWorkshopDate(startsAt) {
  if (!startsAt) return 'To be confirmed';
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return 'To be confirmed';
  const date = d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} | ${time}`;
}

function mapDbWorkshop(w) {
  return {
    id: w.id,
    title: w.title,
    speaker: w.speaker,
    speakerBio: w.speakerBio ?? '',
    hostOrganization: w.hostOrganization ?? '',
    description: w.description ?? '',
    location: w.location,
    date: formatWorkshopDate(w.startsAt),
    faculty: w.facultyId ?? null,
    facultyId: w.facultyId ?? null,
    xpReward: w.xpValue ?? 150,
    tags: Array.isArray(w.tags) && w.tags.length ? w.tags : ['CPDC Event'],
    category: w.category ?? null,
    coverImage: w.coverImage ?? null,
    capacity: w.capacity ?? null,
    endsAt: w.endsAt ?? null,
    virtualLink: w.virtualLink ?? null,
    roomDetails: w.roomDetails ?? null,
    prereqs: w.prerequisites ?? null,
    agenda: Array.isArray(w.agenda) ? w.agenda : [],
    learningOutcomes: Array.isArray(w.learningOutcomes) ? w.learningOutcomes : [],
    registrationDeadline: w.registrationDeadline ?? null,
    seatsLeft: w.seatsLeft ?? null,
    rsvpCount: w.rsvpCount ?? 0,
    qrCode: w.qrSecret ?? null,
    registered: Boolean(w.rsvped),
    attended: Boolean(w.attended),
    isDemo: false,
  };
}

function mapStaticWorkshop(workshop, student) {
  // The static registry may contain a demo QR secret. Keep the instant
  // fallback useful without ever rendering that credential as if it were a
  // live server-issued code.
  const safeWorkshop = { ...workshop };
  delete safeWorkshop.qrCode;
  return {
    ...safeWorkshop,
    qrCode: null,
    attended: (student?.workshopAttendance ?? []).some((attendance) => attendance.workshopId === workshop.id),
    isDemo: true,
  };
}

export default function WorkshopHub({ student, activeFaculty, currentRole = 'STUDENT', initialSubTab = 'workshops' }) {
  const isStudent = currentRole === 'STUDENT';
  const publisherLabel = {
    HEAD_OF_PROGRAMME: 'Programme event editor',
    FACULTY_COORDINATOR: 'Faculty event editor',
    PLACEMENT_OFFICER: 'Placement event editor',
    CPDC_ADMIN: 'CPDC event publisher',
    SUPER_ADMIN: 'University event publisher',
  }[currentRole] ?? 'Event publisher';
  // Seed from the static registry so the feed paints instantly, then replace
  // with the authoritative database list (published events, live RSVP and
  // attendance state) as soon as it loads.
  const [workshopsList, setWorkshopsList] = useState(() => WORKSHOPS.map((workshop) => mapStaticWorkshop(workshop, student)));
  const [loadError, setLoadError] = useState('');
  const [workshopsLoading, setWorkshopsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const reloadWorkshops = React.useCallback(async () => {
    setWorkshopsLoading(true);
    try {
      const { workshops } = await fetchWorkshops(currentRole);
      if (Array.isArray(workshops)) {
        setWorkshopsList(workshops.map(mapDbWorkshop));
        setLoadError('');
      }
    } catch (error) {
      setLoadError(error.message || 'Could not load workshops from the server.');
    } finally {
      setWorkshopsLoading(false);
    }
  }, [currentRole]);

  useEffect(() => {
    reloadWorkshops();
  }, [reloadWorkshops]);
  const [coursesList] = useState(() => ONLINE_COURSES.map((course) => ({
    ...course,
    // A catalogue fixture is not evidence. Only a persisted student course
    // record may render a completed state here.
    completed: isStudent && (student?.courses ?? []).some((saved) => saved.courseId === course.id),
  })));
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // 'workshops' | 'coursera' | 'admin_publish'
  const [settings] = useSettings();
  const canPublish = ['HEAD_OF_PROGRAMME', 'FACULTY_COORDINATOR', 'PLACEMENT_OFFICER', 'CPDC_ADMIN', 'SUPER_ADMIN'].includes(currentRole);
  const tabIds = canPublish ? ['workshops', 'coursera', 'admin_publish'] : ['workshops', 'coursera'];
  const { getTabProps } = useAccessibleTabs(tabIds, activeSubTab, setActiveSubTab);
  const [qrModal, setQrModal] = useState(null); // workshop object when scanning
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedSuccess, setScannedSuccess] = useState(false);
  const [checkInXp, setCheckInXp] = useState(0);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');
  const [publishMessageTone, setPublishMessageTone] = useState('info');

  const showPublishMessage = (message, tone = 'info', duration = 4000) => {
    setPublishMessage(message);
    setPublishMessageTone(tone);
    setTimeout(() => setPublishMessage(''), duration);
  };

  const matchedWorkshops = useMemo(() => workshopsList
    .map((workshop) => ({
      ...workshop,
      ...workshopMatch(workshop, {
        facultyId: activeFaculty?.id,
        programme: student?.programme,
        year: student?.year,
        interests: `${student?.careerTargets ?? ''} ${student?.industries ?? ''} ${(student?.skills ?? []).join(' ')}`,
        gapTags: student?.diagnosticResult?.gapTags,
        weights: settings.matchWeights,
      }),
    }))
    .sort((a, b) => b.score - a.score), [workshopsList, activeFaculty?.id, student, settings.matchWeights]);

  useEffect(() => {
    if (!canPublish && activeSubTab === 'admin_publish') {
      setActiveSubTab('workshops');
    }
  }, [activeSubTab, canPublish]);

  useEffect(() => {
    if (!selectedWorkshop && !selectedCourse && !qrModal) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setQrModal(null);
      setSelectedWorkshop(null);
      setSelectedCourse(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [qrModal, selectedCourse, selectedWorkshop]);

  // Admin New Workshop State
  const [newTitle, setNewTitle] = useState('');
  const [newSpeaker, setNewSpeaker] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCover, setNewCover] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSpeakerBio, setNewSpeakerBio] = useState('');
  const [newHostOrganization, setNewHostOrganization] = useState('');
  const [newVirtualLink, setNewVirtualLink] = useState('');
  const [newRoomDetails, setNewRoomDetails] = useState('');
  const [newPrerequisites, setNewPrerequisites] = useState('');
  const [newOutcomes, setNewOutcomes] = useState('');
  const [newAgenda, setNewAgenda] = useState('');
  const [coverDragging, setCoverDragging] = useState(false);

  // Read a chosen/dropped image into a data URL so the cover previews instantly
  // and rides along on the published workshop card. Real file storage is a
  // backend concern; this keeps the staff flow honest without a fake endpoint.
  const readCover = (file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setNewCover(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleRegisterWorkshop = async (w) => {
    if (!isStudent || w.isDemo || busyId) {
      if (w.isDemo) showPublishMessage('This is demo catalogue content. Registration is available when live workshop data is connected.', 'info', 3600);
      return;
    }
    const going = !w.registered;
    setBusyId(w.id);
    // Optimistic; reconciled from the server's seat count.
    setWorkshopsList((prev) => prev.map((it) => (it.id === w.id ? { ...it, registered: going } : it)));
    try {
      const res = await rsvpWorkshop(w.id, going);
      setWorkshopsList((prev) =>
        prev.map((it) =>
          it.id === w.id
            ? { ...it, registered: going, rsvpCount: res.rsvpCount ?? it.rsvpCount, seatsLeft: res.seatsLeft ?? it.seatsLeft }
            : it,
        ),
      );
    } catch (error) {
      // Roll back and surface the reason (e.g. workshop full).
      setWorkshopsList((prev) => prev.map((it) => (it.id === w.id ? { ...it, registered: !going } : it)));
      showPublishMessage(error.message || 'Could not update your RSVP.', 'error', 2600);
    } finally {
      setBusyId(null);
    }
  };

  // Real QR check-in: validates the code server-side, writes a WorkshopAttendance
  // row and an idempotent XP award, and returns the student's new ledger total.
  // A second scan is a safe no-op (already checked in, no duplicate XP).
  const handleSimulateQRScan = async (workshop) => {
    if (!isStudent || workshop.isDemo || isScanning || workshop.attended) {
      if (workshop.isDemo) showPublishMessage('This demo workshop has no live attendance record to check in.', 'info', 3600);
      return;
    }
    setIsScanning(true);
    try {
      const res = await checkInWorkshop(
        workshop.qrCode ? { qrSecret: workshop.qrCode } : { workshopId: workshop.id },
      );
      setIsScanning(false);
      setScannedSuccess(true);
      const awardedXp = Number(res.xpAwarded) || 0;
      setCheckInXp(awardedXp);
      setAlreadyCheckedIn(Boolean(res.alreadyCheckedIn) || awardedXp === 0);
      if (awardedXp > 0) { import('canvas-confetti').then(({ default: confetti }) => confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } })); }

      setWorkshopsList((prev) => prev.map((item) => (
        item.id === workshop.id ? { ...item, attended: true } : item
      )));
      if (typeof res.xp === 'number') emitXpUpdated(res.xp);

      setTimeout(() => {
        setScannedSuccess(false);
        setQrModal(null);
      }, 2000);
    } catch (error) {
      setIsScanning(false);
      showPublishMessage(error.message || 'Check-in failed — that code is not valid.', 'error', 2600);
    }
  };

  // Parse the registry's display date ("2026-09-05 | 14:00 GMT+8") or an ISO
  // string into an ISO timestamp the API accepts. A missing/invalid date is a
  // user-correctable form error; never silently publish an event on a made-up
  // date.
  const toIsoStart = (value) => {
    const raw = String(value ?? '').trim();
    const match = /^(\d{4}-\d{2}-\d{2})\s*\|\s*(\d{2}:\d{2})\s*GMT([+-]\d{1,2})$/.exec(raw);
    if (match) {
      const [, day, time, off] = match;
      const offset = `${off.startsWith('-') ? '-' : '+'}${String(Math.abs(Number(off))).padStart(2, '0')}:00`;
      const d = new Date(`${day}T${time}:00${offset}`);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct.toISOString();
    throw new Error('Enter a valid date and time before publishing the workshop.');
  };

  const [publishing, setPublishing] = useState(false);
  const [newCapacity, setNewCapacity] = useState('');

  const handlePublishWorkshop = async (e) => {
    e.preventDefault();
    if (!canPublish || !newTitle || !newSpeaker || publishing) return;
    setPublishing(true);
    try {
      await publishWorkshop(
        {
          title: newTitle,
          speaker: newSpeaker,
          speakerBio: newSpeakerBio || null,
          hostOrganization: newHostOrganization || null,
          description: newDescription,
          startsAt: toIsoStart(newDate),
          location: newLocation || null,
          virtualLink: newVirtualLink || null,
          roomDetails: newRoomDetails || null,
          prerequisites: newPrerequisites || null,
          learningOutcomes: newOutcomes.split('\n').map((item) => item.trim()).filter(Boolean),
          agenda: newAgenda.split('\n').map((line) => {
            const [time, title, ...rest] = line.split('|').map((part) => part.trim());
            return { time: time || 'Session', title: title || 'Session detail', description: rest.join(' | ') };
          }).filter((item) => item.title !== 'Session detail' || item.time !== 'Session'),
          coverImage: newCover || null,
          capacity: newCapacity ? Number(newCapacity) : null,
          xpValue: 250,
          facultyId: activeFaculty.id,
          category: 'Faculty Focus',
          tags: ['Faculty Focus', 'Career Skill'],
        },
        currentRole,
      );
      await reloadWorkshops();
      setNewTitle('');
      setNewSpeaker('');
      setNewDescription('');
      setNewSpeakerBio('');
      setNewHostOrganization('');
      setNewVirtualLink('');
      setNewRoomDetails('');
      setNewPrerequisites('');
      setNewOutcomes('');
      setNewAgenda('');
      setNewDate('');
      setNewLocation('');
      setNewCover('');
      setNewCapacity('');
      setActiveSubTab('workshops');
      showPublishMessage('Workshop published to the student feed — it will persist across refreshes.', 'success');
    } catch (error) {
      showPublishMessage(error.message || 'Could not publish the workshop.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Subnav & Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b border-black/10 pb-6">
        <div>
          <h2 className="section-title flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-crimson" />
            <span>Smart Workshop Hub & Coursera Integration</span>
          </h2>
          <p className="section-subtitle mt-1.5 max-w-lg">
            Rules-based workshop matching, fast QR code attendance check-in, and online learning API sync.
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex max-w-full items-center gap-1 overflow-x-auto bg-black/[0.03] p-1 rounded-xl border border-black/10" role="tablist" aria-label="Workshop hub views">
          <button
            type="button"
            {...getTabProps('workshops')}
            role="tab"
            id="workshop-tab-workshops"
            aria-selected={activeSubTab === 'workshops'}
            aria-controls="workshop-panel-workshops"
            onClick={() => setActiveSubTab('workshops')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'workshops' ? 'bg-crimson text-white' : 'text-muted hover:text-[#1d1d1f]'
            }`}
          >
            Live Workshops
          </button>

          <button
            type="button"
            {...getTabProps('coursera')}
            role="tab"
            id="workshop-tab-coursera"
            aria-selected={activeSubTab === 'coursera'}
            aria-controls="workshop-panel-coursera"
            onClick={() => setActiveSubTab('coursera')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'coursera' ? 'bg-crimson text-white' : 'text-muted hover:text-[#1d1d1f]'
            }`}
          >
            Coursera / edX Sync
          </button>

          {canPublish && (
            <button
              type="button"
              {...getTabProps('admin_publish')}
              role="tab"
              id="workshop-tab-admin-publish"
              aria-selected={activeSubTab === 'admin_publish'}
              aria-controls="workshop-panel-admin-publish"
              onClick={() => setActiveSubTab('admin_publish')}
              className={`whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeSubTab === 'admin_publish' ? 'bg-crimson text-white' : 'text-muted hover:text-[#1d1d1f]'
              }`}
            >
              + {publisherLabel}
            </button>
          )}
        </div>
      </div>

      {publishMessage && (
        <div
          className={`rounded-[14px] px-4 py-3 text-sm font-semibold ${publishMessageTone === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-amber-200 bg-amber-50 text-amber-800'}`}
          role={publishMessageTone === 'error' ? 'alert' : 'status'}
        >
          {publishMessage}
        </div>
      )}

      {/* SUB-TAB 1: LIVE WORKSHOPS */}
      {activeSubTab === 'workshops' && (
        <div id="workshop-panel-workshops" role="tabpanel" aria-labelledby="workshop-tab-workshops">
          {loadError && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
              <span>{loadError} Live data is unavailable, so this page is showing the demo catalogue. Demo items cannot be registered or checked in.</span>
              <button type="button" onClick={reloadWorkshops} className="secondary-btn py-2 text-xs">Retry</button>
            </div>
          )}
          {workshopsLoading ? (
            <div className="surface p-8 text-center text-sm text-muted" role="status">Loading workshops…</div>
          ) : matchedWorkshops.length === 0 ? (
            <div className="surface p-8 text-center text-sm text-muted">No workshops are published for this feed yet. Check back soon.</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {matchedWorkshops.map(w => {
            const isFacultyMatch = w.faculty === activeFaculty.id;
            return (
              <div
                key={w.id}
                className={`surface surface-interactive p-7 space-y-5 relative overflow-hidden ${
                  isFacultyMatch ? 'border-crimson/30' : ''
                }`}
              >
                {w.coverImage && (
                  <div className="-mx-7 -mt-7 mb-1 h-32 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.coverImage} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                {/* Rules-based Match Badge — the one eye-catching element per card */}
                <div className="flex items-center justify-between gap-3">
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-crimson text-white flex items-center gap-1.5 shadow-[0_4px_15px_var(--crimson-glow)]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{w.score}% Rules-based match for {activeFaculty.code}</span>
                  </span>

                  <span className="text-xs font-semibold text-muted flex items-center gap-1 whitespace-nowrap">
                    <Award className="w-4 h-4" />
                    +{w.xpReward} XP
                  </span>
                </div>

                {/* Workshop Details */}
                <div className="space-y-1.5">
                  <h3 className="text-xl font-heading font-semibold text-[#1d1d1f] leading-snug">{w.title}</h3>
                  <p className="text-sm text-muted">Speaker <span className="text-[#6e6e73] font-medium">{w.speaker || 'Not provided'}</span></p>
                  <p className="text-xs text-crimson">Why this matches: {w.reasons.join(' · ')}</p>
                </div>

                <div className="space-y-2 text-xs text-muted bg-black/[0.03] p-4 rounded-[18px] border border-black/[0.06]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{w.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{w.location || 'To be confirmed'}</span>
                  </div>
                  {w.capacity != null && <div className="flex items-center gap-2"><UserCheck className="w-3.5 h-3.5" /><span>{w.seatsLeft} seat{w.seatsLeft === 1 ? '' : 's'} remaining</span></div>}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {w.tags.map((t, idx) => (
                    <span key={idx} className="text-[10px] px-2.5 py-1 rounded-full bg-black/[0.03] text-muted font-medium">
                      #{t}
                    </span>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedWorkshop(w)}
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-black/[0.04] text-[#1d1d1f] hover:bg-black/[0.08] transition flex items-center justify-center gap-2 border border-black/10"
                  >
                    <BookOpen className="w-4 h-4 text-crimson" />
                    <span>View Syllabus, Speaker & Logistics</span>
                  </button>
                  {isStudent && !w.isDemo ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleRegisterWorkshop(w)}
                        disabled={busyId === w.id || (!w.registered && w.seatsLeft === 0)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                          w.registered
                            ? 'bg-emerald-50/60 text-emerald-700 border border-emerald-500/30'
                            : 'crimson-btn'
                        }`}
                      >
                        {w.registered ? <CheckCircle2 className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        <span>
                          {w.registered
                            ? 'Registered'
                            : w.seatsLeft === 0
                            ? 'Full'
                            : w.seatsLeft != null
                            ? `Register (${w.seatsLeft} left)`
                            : 'Register Now'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQrModal(w);
                          setScannedSuccess(false);
                          setCheckInXp(0);
                          setAlreadyCheckedIn(Boolean(w.attended));
                        }}
                        className="secondary-btn text-xs py-2.5"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Scan QR</span>
                      </button>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2.5 text-center text-[11px] leading-relaxed text-muted">
                      {w.isDemo ? 'Demo catalogue item — live registration and attendance are unavailable.' : 'Registration and attendance check-in are available from the student view only.'}
                    </p>
                  )}
                </div>

              </div>
            );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: COURSERA / EDX INTEGRATION */}
      {activeSubTab === 'coursera' && (
        <div id="workshop-panel-coursera" role="tabpanel" aria-labelledby="workshop-tab-coursera" className="space-y-6">
          <div className="p-5 rounded-[18px] surface flex items-center justify-between gap-4">
            <div>
              <h3 className="font-heading font-semibold text-base text-[#1d1d1f]">Coursera & edX course catalogue</h3>
              <p className="text-sm text-muted mt-0.5">Open the exact external course and submit real evidence in Learning Hub for staff verification.</p>
            </div>
            <span className="badge-pill bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 whitespace-nowrap">
              Provider links ready
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-[14px] border border-crimson/15 bg-crimson/[0.03] px-4 py-3 text-xs text-muted">
            <BookOpen className="h-4 w-4 shrink-0 text-crimson" />
            <span>Learning paths are grouped by faculty focus; sync a verified certificate to unlock the related badge.</span>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {coursesList.map(c => (
              <div key={c.id} className="surface p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className={`flex h-28 items-end rounded-[18px] p-4 text-white ${c.id === 'c1' ? 'bg-gradient-to-br from-crimson to-rose-900' : c.id === 'c2' ? 'bg-gradient-to-br from-slate-700 to-slate-950' : 'bg-gradient-to-br from-emerald-600 to-teal-950'}`}>
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Learning path</p><p className="mt-1 font-heading text-lg font-bold">{c.skillBadge}</p></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="badge-pill bg-black/[0.03] text-muted border border-black/10">
                      {c.platform}
                    </span>
                    <span className="text-xs font-semibold text-muted">+{c.xp} XP</span>
                  </div>

                  <h3 className="font-heading font-semibold text-lg text-[#1d1d1f] leading-snug">{c.title}</h3>
                  <p className="text-xs text-muted">Issued by <span className="text-[#6e6e73] font-medium">{c.provider}</span></p>
                </div>

                <div className="pt-4 border-t border-black/10 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Skill Badge</span>
                    <span className="text-[#6e6e73] font-semibold">{c.skillBadge}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCourse(c)}
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-black/[0.04] text-[#1d1d1f] hover:bg-black/[0.08] transition flex items-center justify-center gap-1.5 border border-black/10"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-crimson" />
                    <span>View Syllabus & Accreditation</span>
                  </button>

                  {c.externalUrl && (
                    <a
                      href={c.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#1d1d1f] bg-blue-50/70 border border-blue-200 hover:bg-blue-100 py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600" /> Open Course on {String(c.platform).split(' ')[0]}
                    </a>
                  )}

                  {c.completed ? (
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-xl bg-emerald-50/40 border border-emerald-500/30 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Certificate Synced & Badge Granted</span>
                      </div>
                      {c.certUrl && (
                        <a
                          href={c.certUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-muted hover:text-[#1d1d1f] transition flex items-center justify-center gap-1 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" /> View Verified Credential
                        </a>
                      )}
                    </div>
                  ) : (
                    isStudent ? (
                    <Link href="/learning" className="w-full crimson-btn justify-center text-xs py-2.5">
                      <Award className="w-4 h-4" />
                      <span>Submit evidence in Learning Hub</span>
                    </Link>
                    ) : (
                      <p className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2.5 text-center text-[11px] leading-relaxed text-muted">
                        Student evidence submissions and verification decisions are managed in Learning Hub.
                      </p>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CPDC ADMIN PUBLISHER */}
      {canPublish && activeSubTab === 'admin_publish' && (
        <div id="workshop-panel-admin-publish" role="tabpanel" aria-labelledby="workshop-tab-admin-publish" className="surface p-8 max-w-2xl mx-auto space-y-6">
          <div className="border-b border-black/10 pb-4">
            <h3 className="text-lg font-heading font-semibold text-[#1d1d1f] flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-crimson" />
              <span>{publisherLabel} — Publish Workshop</span>
            </h3>
            <p className="text-sm text-muted mt-1">Post new career events to student feeds with rules-based match scores.</p>
          </div>

          <form onSubmit={handlePublishWorkshop} className="space-y-5">
            <div>
              <label htmlFor="workshop-title" className="block text-xs font-semibold text-muted mb-1.5">Workshop Title</label>
              <input
                id="workshop-title"
                type="text"
                placeholder="e.g. McKinsey Strategy & Consulting Case Workshop"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
                required
              />
            </div>

            <div>
              <label htmlFor="workshop-description" className="block text-xs font-semibold text-muted mb-1.5">What is this session about?</label>
              <textarea
                id="workshop-description"
                rows={3}
                placeholder="Audience, problem context and the practical value of attending"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full rounded-[18px] bg-black/[0.04] border border-black/10 px-4 py-3 text-sm text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="workshop-speaker" className="block text-xs font-semibold text-muted mb-1.5">Speaker / Facilitator</label>
                <input
                  id="workshop-speaker"
                  type="text"
                  placeholder="e.g. Sarah Jenkins (Managing Director)"
                  value={newSpeaker}
                  onChange={(e) => setNewSpeaker(e.target.value)}
                  className="w-full h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
                  required
                />
              </div>

              <div>
                <label htmlFor="workshop-date" className="block text-xs font-semibold text-muted mb-1.5">Date & Time</label>
                <input
                  id="workshop-date"
                  type="text"
                  placeholder="e.g. 2026-09-05 | 14:00 GMT+8"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-muted">Speaker biography
                <textarea rows={4} value={newSpeakerBio} onChange={(e) => setNewSpeakerBio(e.target.value)} placeholder="Credentials, current role and relevant experience" className="mt-1.5 w-full rounded-[16px] border border-black/10 bg-black/[0.04] px-3 py-2.5 text-sm font-normal text-[#1d1d1f] outline-none focus:border-crimson" />
              </label>
              <label className="block text-xs font-semibold text-muted">Host / organisation
                <input value={newHostOrganization} onChange={(e) => setNewHostOrganization(e.target.value)} placeholder="Faculty, lab, company or partner" className="mt-1.5 h-11 w-full rounded-[16px] border border-black/10 bg-black/[0.04] px-3 text-sm font-normal text-[#1d1d1f] outline-none focus:border-crimson" />
              </label>
            </div>

            <div>
              <label htmlFor="workshop-capacity" className="block text-xs font-semibold text-muted mb-1.5">Seat capacity <span className="font-normal">(optional)</span></label>
              <input
                id="workshop-capacity"
                type="number"
                min="1"
                max="100000"
                placeholder="Leave blank for unlimited"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
                className="w-full h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
              />
            </div>

            <div>
              <label htmlFor="workshop-location" className="block text-xs font-semibold text-muted mb-1.5">Venue / Virtual Stream</label>
              <input
                id="workshop-location"
                type="text"
                placeholder="e.g. Faculty Auditorium B & Zoom Live"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="w-full h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-muted">Virtual link (optional)
                <input type="url" value={newVirtualLink} onChange={(e) => setNewVirtualLink(e.target.value)} placeholder="https://…" className="mt-1.5 h-11 w-full rounded-[16px] border border-black/10 bg-black/[0.04] px-3 text-sm font-normal text-[#1d1d1f] outline-none focus:border-crimson" />
              </label>
              <label className="block text-xs font-semibold text-muted">Room / access details
                <textarea rows={2} value={newRoomDetails} onChange={(e) => setNewRoomDetails(e.target.value)} placeholder="Building, room, accessibility and equipment" className="mt-1.5 w-full rounded-[16px] border border-black/10 bg-black/[0.04] px-3 py-2.5 text-sm font-normal text-[#1d1d1f] outline-none focus:border-crimson" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-muted">Prerequisites / preparation
                <textarea rows={3} value={newPrerequisites} onChange={(e) => setNewPrerequisites(e.target.value)} placeholder="Required prior knowledge, equipment or dress code" className="mt-1.5 w-full rounded-[16px] border border-black/10 bg-black/[0.04] px-3 py-2.5 text-sm font-normal text-[#1d1d1f] outline-none focus:border-crimson" />
              </label>
              <label className="block text-xs font-semibold text-muted">Learning outcomes (one per line)
                <textarea rows={3} value={newOutcomes} onChange={(e) => setNewOutcomes(e.target.value)} placeholder="Build…\nExplain…\nDemonstrate…" className="mt-1.5 w-full rounded-[16px] border border-black/10 bg-black/[0.04] px-3 py-2.5 text-sm font-normal text-[#1d1d1f] outline-none focus:border-crimson" />
              </label>
            </div>

            <label className="block text-xs font-semibold text-muted">Timed agenda (one per line: time | title | detail)
              <textarea rows={4} value={newAgenda} onChange={(e) => setNewAgenda(e.target.value)} placeholder="14:00–14:30 | Keynote | Context and goals\n14:30–15:30 | Practicum | Guided activity\n15:30–16:00 | Q&A | Questions and next steps" className="mt-1.5 w-full rounded-[16px] border border-black/10 bg-black/[0.04] px-3 py-2.5 text-sm font-normal text-[#1d1d1f] outline-none focus:border-crimson" />
            </label>

            <div>
              <span className="block text-xs font-semibold text-muted mb-1.5">Cover image</span>
              <label
                onDragOver={(e) => { e.preventDefault(); setCoverDragging(true); }}
                onDragLeave={() => setCoverDragging(false)}
                onDrop={(e) => { e.preventDefault(); setCoverDragging(false); readCover(e.dataTransfer.files?.[0]); }}
                className={`flex cursor-pointer items-center gap-4 rounded-[18px] border border-dashed p-4 transition ${
                  coverDragging ? 'border-crimson bg-crimson/[0.05]' : 'border-black/20 hover:bg-black/[0.02]'
                }`}
              >
                <input type="file" accept="image/*" className="sr-only"
                  onChange={(e) => readCover(e.target.files?.[0])} aria-label="Upload workshop cover image" />
                {newCover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={newCover} alt="" className="h-16 w-28 shrink-0 rounded-[12px] border border-black/10 object-cover" />
                ) : (
                  <span className="flex h-16 w-28 shrink-0 items-center justify-center rounded-[12px] bg-black/[0.04] text-muted">
                    <Camera className="w-6 h-6" aria-hidden="true" />
                  </span>
                )}
                <span className="text-xs text-muted">
                  {newCover
                    ? 'Looks good — drop or choose another image to replace it.'
                    : 'Drag & drop a cover image, or click to choose. It appears on the student card, cropped automatically.'}
                </span>
              </label>
              {newCover && (
                <button type="button" onClick={() => setNewCover('')}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-crimson">
                  <X className="w-3 h-3" aria-hidden="true" /> Remove image
                </button>
              )}
            </div>

            <button type="submit" disabled={publishing} className="w-full crimson-btn justify-center py-3 text-sm disabled:opacity-60">
              <PlusCircle className="w-4 h-4" />
              <span>{publishing ? 'Publishing…' : `Publish Workshop to ${activeFaculty.code} Feed`}</span>
            </button>
          </form>
        </div>
      )}

      {/* QR SCANNER MODAL */}
      {isStudent && qrModal && !qrModal.isDemo && (
        <DismissibleDialog
          onClose={() => setQrModal(null)}
          labelledBy="qr-checkin-heading"
          overlayClassName="bg-black/80 backdrop-blur-md"
          className="surface relative my-4 max-h-[calc(100vh-2rem)] w-full max-w-sm space-y-6 overflow-y-auto rounded-3xl p-7 text-center shadow-lg"
        >
            <button
              type="button"
              onClick={() => setQrModal(null)}
              aria-label="Close QR check-in"
              className="icon-btn absolute right-4 top-4"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 id="qr-checkin-heading" className="font-heading font-semibold text-lg text-[#1d1d1f]">QR Fast Check-in</h3>
              <p className="text-sm text-muted mt-1">{qrModal.title}</p>
            </div>

            {/* Camera View Finder Box */}
            <div className="w-56 h-56 mx-auto bg-black/[0.03] rounded-[18px] border-2 border-dashed border-crimson/50 flex flex-col items-center justify-center relative overflow-hidden p-4">

              {isScanning ? (
                <div className="space-y-3">
                  <Camera className="w-10 h-10 text-crimson animate-pulse mx-auto" />
                  <p className="text-xs font-semibold text-crimson">Scanning QR Code...</p>
                  <div className="w-32 bg-black/[0.06] h-1.5 rounded-full overflow-hidden mx-auto">
                    <div className="bg-crimson h-full w-full animate-pulse"></div>
                  </div>
                </div>
              ) : scannedSuccess ? (
                <div className="space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <p className="text-xs font-semibold text-emerald-700">Attendance Logged!</p>
                  <span className="text-[10px] text-muted font-bold">
                    {alreadyCheckedIn ? 'Already recorded — no additional XP' : `+${checkInXp} XP awarded`}
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <QrCode className="w-16 h-16 text-muted mx-auto" />
                  <span className="text-[10px] text-muted">{qrModal.qrCode ? 'Ready to verify this QR code.' : 'Demo check-in is ready for this local workshop.'}</span>
                </div>
              )}

              {/* Red Laser Scanning Beam */}
              {isScanning && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-crimson shadow-lg shadow-crimson/80 animate-bounce" style={{ animationDuration: '1s' }}></div>
              )}
            </div>

            {!scannedSuccess && (
              <button
                type="button"
                onClick={() => handleSimulateQRScan(qrModal)}
                disabled={isScanning || qrModal.attended}
                className="w-full crimson-btn justify-center text-xs py-2.5"
              >
                <Camera className="w-4 h-4" />
                <span>{isScanning ? 'Verifying...' : qrModal.attended ? 'Attendance already logged' : qrModal.qrCode ? 'Verify QR check-in' : 'Verify attendance (demo)'}</span>
              </button>
            )}
        </DismissibleDialog>
      )}

      {/* DEEP WORKSHOP DETAILS MODAL */}
      {selectedWorkshop && (
        <DismissibleDialog
          onClose={() => setSelectedWorkshop(null)}
          labelledBy={`workshop-detail-title-${selectedWorkshop.id}`}
          className="surface my-8 max-h-[90vh] w-full max-w-2xl space-y-6 overflow-y-auto rounded-3xl border border-black/10 p-7 text-left relative shadow-2xl"
        >
            <button
              type="button"
              onClick={() => setSelectedWorkshop(null)}
              aria-label="Close modal"
              className="icon-btn absolute right-5 top-5"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="space-y-2 border-b border-black/10 pb-4 pr-8">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-crimson text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{selectedWorkshop.score != null ? `${selectedWorkshop.score}% Rules-based match` : 'Rules-based match'}</span>
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> +{selectedWorkshop.xpReward || 200} Professionalism XP
                </span>
              </div>
              <h3 id={`workshop-detail-title-${selectedWorkshop.id}`} className="text-2xl font-heading font-bold text-[#1d1d1f]">{selectedWorkshop.title}</h3>
              <p className="text-sm text-muted">Hosted by <span className="text-[#1d1d1f] font-bold">{selectedWorkshop.speaker}</span></p>
              {selectedWorkshop.hostOrganization && <p className="text-xs text-muted">Organised by {selectedWorkshop.hostOrganization}</p>}
            </div>

            {selectedWorkshop.description && (
              <div className="rounded-[20px] border border-crimson/15 bg-crimson/[0.03] p-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Session brief</h4>
                <p className="mt-2 text-sm leading-relaxed text-[#1d1d1f]">{selectedWorkshop.description}</p>
              </div>
            )}

            {/* Speaker Credentials & Bio */}
            <div className="bg-black/[0.03] p-5 rounded-[20px] border border-black/[0.06] space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-crimson" /> Facilitator Credentials & Biography
              </h4>
              <p className="text-sm text-[#1d1d1f] leading-relaxed font-medium">
                {selectedWorkshop.speakerBio || 'Not provided'}
              </p>
            </div>

            {/* Logistics & Access Coordinates */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="surface p-4 rounded-2xl space-y-2 border border-black/10">
                <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase">
                  <MapPin className="w-4 h-4 text-crimson" /> Physical Venue & Facility
                </div>
                <p className="text-sm font-bold text-[#1d1d1f]">{selectedWorkshop.location || 'To be confirmed'}</p>
                <p className="text-xs text-muted leading-relaxed">
                  {selectedWorkshop.roomDetails || 'Not provided'}
                </p>
              </div>

              <div className="surface p-4 rounded-2xl space-y-2 border border-black/10">
                <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase">
                  <Clock className="w-4 h-4 text-crimson" /> Schedule & Virtual Access
                </div>
                <p className="text-sm font-bold text-[#1d1d1f]">{selectedWorkshop.date || 'To be confirmed'}</p>
                {selectedWorkshop.virtualLink ? (
                  <a
                    href={selectedWorkshop.virtualLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 underline mt-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Join Live Stream
                  </a>
                ) : (
                  <p className="text-xs text-muted mt-1">Virtual access: Not provided</p>
                )}
              </div>
            </div>

            {/* Prereqs & Learning Outcomes */}
            <div className="space-y-3">
              {selectedWorkshop.prereqs && (
                <div className="text-xs text-muted bg-amber-50 border border-amber-200/60 text-amber-900 p-3 rounded-xl font-medium">
                  <strong>Prerequisites & Preparation:</strong> {selectedWorkshop.prereqs}
                </div>
              )}

              <h4 className="text-sm font-bold text-[#1d1d1f] pt-1">Key Competency Learning Outcomes</h4>
              {Array.isArray(selectedWorkshop.learningOutcomes) && selectedWorkshop.learningOutcomes.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#1d1d1f] font-medium">
                  {selectedWorkshop.learningOutcomes.map((outcome, index) => (
                    <li key={index} className="leading-snug">{outcome}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Not provided</p>
              )}
            </div>

            {/* Granular Timed Agenda */}
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-crimson" /> Detailed Session Syllabus & Timeline
              </h4>
              {Array.isArray(selectedWorkshop.agenda) && selectedWorkshop.agenda.length > 0 ? (
                <div className="space-y-3 border-l-2 border-crimson/30 ml-2 pl-4">
                  {selectedWorkshop.agenda.map((slot, i) => (
                    <div key={i} className="space-y-1">
                      <span className="text-xs font-bold text-crimson uppercase tracking-wide">{slot.time}</span>
                      <p className="text-sm font-bold text-[#1d1d1f]">{slot.title}</p>
                      <p className="text-xs text-muted leading-relaxed">{slot.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Not provided</p>
              )}
            </div>

            {/* Action Buttons inside Modal */}
            <div className="flex flex-col items-stretch gap-3 border-t border-black/10 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {!selectedWorkshop.isDemo ? <Link href={`/workshops/${encodeURIComponent(selectedWorkshop.id)}`} className="secondary-btn w-full font-bold sm:w-auto">Open full event page</Link> : null}
              {isStudent && !selectedWorkshop.isDemo ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedWorkshop;
                      setSelectedWorkshop(null);
                      setQrModal(target);
                      setScannedSuccess(false);
                      setCheckInXp(0);
                      setAlreadyCheckedIn(Boolean(target.attended));
                    }}
                    className="secondary-btn w-full font-bold sm:w-auto"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Launch QR Check-in Scanner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleRegisterWorkshop(selectedWorkshop);
                      setSelectedWorkshop(prev => prev ? { ...prev, registered: !prev.registered } : null);
                    }}
                    disabled={busyId === selectedWorkshop.id || (!selectedWorkshop.registered && selectedWorkshop.seatsLeft === 0)}
                    className={`w-full font-bold sm:w-auto ${selectedWorkshop.registered ? 'secondary-btn btn-success' : 'crimson-btn'} disabled:opacity-60`}
                  >
                    {selectedWorkshop.registered ? <CheckCircle2 className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    <span>{selectedWorkshop.registered ? 'Registered for Workshop' : 'Confirm Workshop Registration'}</span>
                  </button>
                </>
              ) : (
                <p className="w-full text-right text-xs text-muted">{selectedWorkshop.isDemo ? 'Demo catalogue item — live registration and attendance are unavailable.' : 'Read-only details view. Student registration and attendance check-in are available from the student view only.'}</p>
              )}
            </div>
        </DismissibleDialog>
      )}

      {/* DEEP COURSE SYLLABUS & ACCREDITATION MODAL */}
      {selectedCourse && (
        <DismissibleDialog
          onClose={() => setSelectedCourse(null)}
          labelledBy={`course-detail-title-${selectedCourse.id}`}
          className="surface my-8 max-h-[90vh] w-full max-w-2xl space-y-6 overflow-y-auto rounded-3xl border border-black/10 p-7 text-left relative shadow-2xl"
        >
            <button
              type="button"
              onClick={() => setSelectedCourse(null)}
              aria-label="Close modal"
              className="icon-btn absolute right-5 top-5"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="space-y-2 border-b border-black/10 pb-4 pr-8">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/[0.06] text-[#1d1d1f] border border-black/10">
                  {selectedCourse.platform}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> +{selectedCourse.xp} Credential XP & Skill Badge
                </span>
              </div>
              <h3 id={`course-detail-title-${selectedCourse.id}`} className="text-2xl font-heading font-bold text-[#1d1d1f]">{selectedCourse.title}</h3>
              <p className="text-sm text-muted">Offered by <span className="text-[#1d1d1f] font-bold">{selectedCourse.provider}</span></p>
            </div>

            {/* Instructor & Bio */}
            <div className="bg-black/[0.03] p-5 rounded-[20px] border border-black/[0.06] space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-crimson" /> Lead Instructor & Faculty Profile
              </h4>
              <p className="text-sm font-bold text-[#1d1d1f]">
                {selectedCourse.instructor || "Distinguished University Professorship & Enterprise Specialists"}
              </p>
              <p className="text-xs text-muted leading-relaxed font-medium">
                {selectedCourse.instructorBio || "Academic leadership with deep research authority and applied enterprise teaching experience."}
              </p>
            </div>

            {/* Credit Equivalency & Competencies */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-blue-900 space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" /> QIU Senate Academic Credit Recognition
                </h4>
                <p className="text-sm font-bold">
                  {selectedCourse.creditTransferEquivalency || "Recognized under QIU SCL Co-Curricular Transcript Elective Framework."}
                </p>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-muted pt-1">Verified CV Skills Earned Upon Completion</h4>
              <div className="flex flex-wrap gap-2">
                {(selectedCourse.skillsEarned || ["Analytical Reasoning", "Applied Practice", "Domain Expertise", "Digital Literacy"]).map((skill, idx) => (
                  <span key={idx} className="px-3 py-1.5 rounded-lg bg-black/[0.04] border border-black/10 text-xs font-bold text-[#1d1d1f]">
                    ★ {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Week-by-Week Syllabus Breakdown */}
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-crimson" /> Week-by-Week Course Curriculum Syllabus ({selectedCourse.duration})
              </h4>
              <div className="space-y-3 border-l-2 border-blue-500/40 ml-2 pl-4">
                {(selectedCourse.syllabus || [
                  { week: "Module 1", topic: "Core Principles, Vocabulary & Structural Theory", hours: "5 hours self-paced study" },
                  { week: "Module 2", topic: "Analytical Techniques & Problem-Solving Methodologies", hours: "6 hours interactive simulations" },
                  { week: "Module 3", topic: "Practical Application & Industry Case Demonstrations", hours: "6 hours applied practice" },
                  { week: "Module 4", topic: "Final Capstone Assessment & Credential Verification", hours: "5 hours assessment evaluation" }
                ]).map((mod, index) => (
                  <div key={index} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">{mod.week}</span>
                      <span className="text-[11px] font-semibold text-muted">{mod.hours}</span>
                    </div>
                    <p className="text-sm font-bold text-[#1d1d1f]">{mod.topic}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-black/10">
              {selectedCourse.externalUrl && (
                <a
                  href={selectedCourse.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" /> Launch Course on {String(selectedCourse.platform).split(' ')[0]}
                </a>
              )}

              {isStudent ? (
                <Link href="/learning" className="py-2.5 px-6 rounded-xl crimson-btn text-xs font-bold">
                  <Award className="w-4 h-4" />
                  <span>Submit evidence in Learning Hub</span>
                </Link>
              ) : (
                <span className="rounded-xl border border-black/10 bg-black/[0.03] px-4 py-2.5 text-xs text-muted">Student verification actions are hidden for this role.</span>
              )}
            </div>
        </DismissibleDialog>
      )}

    </div>
  );
}
