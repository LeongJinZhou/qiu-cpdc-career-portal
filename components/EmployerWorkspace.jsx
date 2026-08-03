'use client';

import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, CheckCircle2, FileText, Send, Sparkles, Users } from 'lucide-react';
import EmployerMarketplace from '@/components/EmployerMarketplace';
import TalentFeed from '@/components/TalentFeed';
import InviteDialog from '@/components/employer/InviteDialog';
import VacanciesBoard from '@/components/employer/VacanciesBoard';
import { fetchTalentFeed, fetchWorkshopRequests, sendTalentOutreach, submitWorkshopRequest } from '@/lib/api';
import { ROLES } from '@/lib/modules';

export default function EmployerWorkspace({ student, currentRole }) {
  const roleLabel = ROLES.find((role) => role.id === currentRole)?.label ?? currentRole;
  const canManageMarketplace = ['EMPLOYER', 'CPDC_ADMIN', 'SUPER_ADMIN'].includes(currentRole);
  const canHostEvent = currentRole === 'EMPLOYER';
  const tabs = useMemo(() => [
    ...(canManageMarketplace ? [{ id: 'talent', label: 'Talent search', icon: Users }] : []),
    { id: 'vacancies', label: canManageMarketplace ? 'Vacancies' : 'Find opportunities', icon: BriefcaseBusiness },
    { id: 'projects', label: 'Public projects', icon: Sparkles },
    ...(canHostEvent ? [{ id: 'host', label: 'Host an event', icon: BriefcaseBusiness }] : []),
  ], [canHostEvent, canManageMarketplace]);
  const [tab, setTab] = useState('talent');
  const [shortlistIds, setShortlistIds] = useState(() => new Set());
  const [invitedByCandidate, setInvitedByCandidate] = useState({});
  const [request, setRequest] = useState({ title: '', date: '', description: '' });
  const [requestSent, setRequestSent] = useState(false);
  const [hostRequests, setHostRequests] = useState([]);
  const [hostRequestError, setHostRequestError] = useState('');
  const [hostRequestSaving, setHostRequestSaving] = useState(false);
  const [invite, setInvite] = useState(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [liveCandidates, setLiveCandidates] = useState([]);
  const [talentLoading, setTalentLoading] = useState(canManageMarketplace);
  const [talentError, setTalentError] = useState('');

  useEffect(() => {
    if (!canManageMarketplace) return undefined;
    let cancelled = false;
    setTalentLoading(true);
    fetchTalentFeed()
      .then((data) => {
        if (cancelled) return;
        setLiveCandidates((data?.projects ?? []).map((project) => ({
          id: project.id,
          name: project.studentName,
          gradYear: project.reviewedAt ? new Date(project.reviewedAt).getFullYear() : null,
          fypTitle: project.title,
          fypAbstract: project.abstract,
          programme: project.programme,
          faculty: project.faculty,
          facultyId: project.facultyId,
          avatarUrl: project.studentAvatar,
          skills: project.skills ?? [],
          badges: [],
        })));
        setTalentError('');
      })
      .catch((error) => {
        if (!cancelled) setTalentError(error.message || 'Could not load approved talent.');
      })
      .finally(() => {
        if (!cancelled) setTalentLoading(false);
      });
    return () => { cancelled = true; };
  }, [canManageMarketplace]);

  useEffect(() => {
    if (!canHostEvent) return undefined;
    let cancelled = false;
    fetchWorkshopRequests(currentRole)
      .then((data) => {
        if (!cancelled) setHostRequests(data?.requests ?? []);
      })
      .catch((error) => {
        if (!cancelled) setHostRequestError(error.message || 'Could not load your workshop requests.');
      });
    return () => { cancelled = true; };
  }, [canHostEvent, currentRole]);

  const candidates = useMemo(() => liveCandidates, [liveCandidates]);

  // A student/alumnus enters this module to discover and apply. Employer and
  // staff roles enter it to manage opt-in talent and ATS workflows.
  useEffect(() => {
    if (!tabs.some((item) => item.id === tab)) setTab(tabs[0]?.id ?? 'vacancies');
  }, [tab, tabs]);

  const handleShortlist = (candidate) => {
    setShortlistIds((previous) => {
      const next = new Set(previous);
      if (next.has(candidate.id)) next.delete(candidate.id);
      else next.add(candidate.id);
      return next;
    });
  };

  const handleInvite = (candidate, kind) => {
    setInviteError('');
    setInviteMessage('');
    setInvite({ candidate, kind });
  };

  const sendInvite = async ({ candidate, kind, role, when, note }) => {
    setInviteError('');
    setInviteMessage('Recording outreach request…');
    try {
      const structuredMessage = [
        `Role/topic: ${role}`,
        `Proposed time/format: ${when}`,
        note ? `Message: ${note}` : null,
      ].filter(Boolean).join('\n');
      await sendTalentOutreach(candidate.id, kind === 'interview' ? 'INTERVIEW' : 'COFFEE', structuredMessage, currentRole);
      setInvitedByCandidate((previous) => ({ ...previous, [candidate.id]: kind }));
      setInviteMessage(`${kind === 'interview' ? 'Interview invitation' : 'Coffee chat request'} recorded for ${candidate.name}. Delivery is pending the configured notification provider.`);
      setInvite(null);
    } catch (error) {
      setInviteMessage('');
      setInviteError(error.message || 'Could not record this outreach request.');
    }
  };

  const submitEventRequest = async (event) => {
    event.preventDefault();
    if (!request.title.trim() || !request.description.trim() || hostRequestSaving) return;
    setHostRequestSaving(true);
    setHostRequestError('');
    try {
      const data = await submitWorkshopRequest({
        title: request.title,
        preferredDate: request.date || null,
        description: request.description,
      }, currentRole);
      setHostRequests((previous) => [data.request, ...previous]);
      setRequestSent(true);
    } catch (error) {
      setHostRequestError(error.message || 'Could not save the workshop request.');
    } finally {
      setHostRequestSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col gap-4 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">{canManageMarketplace ? 'Verified partner portal' : 'Career opportunities'}</p><h1 className="section-title mt-1 flex items-center gap-2.5"><BriefcaseBusiness className="h-6 w-6 text-crimson" /> {canManageMarketplace ? 'Employer marketplace' : 'Opportunities marketplace'}</h1><p className="section-subtitle mt-1.5 max-w-2xl">{canManageMarketplace ? 'Search opt-in talent, review coordinator-approved projects and send structured outreach without exposing private student data.' : 'Browse live vacancies and coordinator-approved projects matched to the QIU community. Apply from the opportunity card and follow the persisted ATS stage.'}</p></div>
        <span className="badge-pill flex w-fit items-center gap-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> {canManageMarketplace ? 'Verified corporate partner' : `${roleLabel} view`}</span>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-black/10 pb-2" role="tablist" aria-label="Employer portal views">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" id={`employer-tab-${id}`} aria-selected={tab === id} aria-controls={`employer-panel-${id}`} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold ${tab === id ? 'bg-crimson text-white' : 'text-muted hover:bg-black/[0.04] hover:text-[#1d1d1f]'}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>

      {talentError && <p className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" role="alert">{talentError}</p>}
      {inviteError && <p className="rounded-[14px] border border-crimson/25 bg-crimson/[0.05] px-4 py-3 text-sm font-semibold text-crimson" role="alert">{inviteError}</p>}
      {inviteMessage && <p className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700" role="status">{inviteMessage}</p>}

      {tab === 'talent' && canManageMarketplace && <div id="employer-panel-talent" role="tabpanel" aria-labelledby="employer-tab-talent">{talentLoading ? <div className="surface p-10 text-center text-sm text-muted" role="status">Loading coordinator-approved, opt-in talent…</div> : <EmployerMarketplace candidates={candidates} shortlistIds={shortlistIds} invitedByCandidate={invitedByCandidate} onShortlist={handleShortlist} onInvite={handleInvite} />}</div>}

      {tab === 'vacancies' && <div id="employer-panel-vacancies" role="tabpanel" aria-labelledby="employer-tab-vacancies"><VacanciesBoard currentRole={currentRole} /></div>}

      {tab === 'projects' && <div id="employer-panel-projects" role="tabpanel" aria-labelledby="employer-tab-projects"><TalentFeed currentRole={currentRole} student={student} /></div>}

      {tab === 'host' && canHostEvent && <section id="employer-panel-host" role="tabpanel" aria-labelledby="employer-tab-host" className="mx-auto max-w-3xl"><div className="surface space-y-5 p-6"><div className="border-b border-black/10 pb-4"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-crimson" /><h2 className="font-heading text-lg font-semibold">Request to host a QIU workshop</h2></div><p className="mt-1 text-sm text-muted">Your request is saved to the CPDC review queue. Nothing appears in the student feed until a CPDC officer publishes the complete event brief.</p></div>{hostRequestError && <p className="rounded-[14px] border border-crimson/25 bg-crimson/[0.05] px-3 py-2 text-sm font-semibold text-crimson" role="alert">{hostRequestError}</p>}{requestSent ? <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-5 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /><h3 className="mt-3 font-semibold text-emerald-900">Request recorded for CPDC review</h3><p className="mt-1 text-sm text-emerald-800">The title, proposed timing and learning brief are stored for the CPDC team. Delivery notifications depend on the configured provider.</p><button type="button" onClick={() => { setRequestSent(false); setRequest({ title: '', date: '', description: '' }); }} className="secondary-btn mt-4 text-xs">Submit another request</button></div> : <form onSubmit={submitEventRequest} className="space-y-4"><Field label="Session title" value={request.title} onChange={(value) => setRequest((previous) => ({ ...previous, title: value }))} placeholder="e.g. Product analytics careers at Meridian" /><Field label="Preferred date / format" value={request.date} onChange={(value) => setRequest((previous) => ({ ...previous, date: value }))} placeholder="e.g. 12 September · campus + virtual" /><div><label htmlFor="event-request-description" className="mb-1.5 block text-xs font-semibold text-muted">What will students learn?</label><textarea id="event-request-description" required value={request.description} onChange={(event) => setRequest((previous) => ({ ...previous, description: event.target.value }))} rows={5} placeholder="Audience, learning outcomes, speaker profile and capacity" className="w-full rounded-[16px] border border-black/[0.1] bg-black/[0.03] px-4 py-3 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20" /></div><button type="submit" disabled={hostRequestSaving} className="crimson-btn w-full justify-center disabled:opacity-60"><Send className="h-4 w-4" /> {hostRequestSaving ? 'Saving request…' : 'Save request for CPDC'}</button></form>}<div className="border-t border-black/10 pt-5"><h3 className="font-heading text-base font-semibold">Your previous requests</h3>{hostRequests.length ? <ul className="mt-3 space-y-2">{hostRequests.map((item) => <li key={item.id} className="rounded-[14px] border border-black/10 bg-black/[0.02] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-sm">{item.title}</span><span className="badge-pill border border-black/10 bg-white text-muted">{item.status}</span></div><p className="mt-1 text-xs text-muted">{item.preferredDate || 'No preferred date recorded'} · submitted {new Date(item.createdAt).toLocaleDateString()}</p>{item.reviewNote ? <p className="mt-2 text-xs text-[#424245]">CPDC note: {item.reviewNote}</p> : null}</li>)}</ul> : <p className="mt-2 text-sm text-muted">No requests recorded yet.</p>}</div></div></section>}
      {invite ? <InviteDialog candidate={invite.candidate} kind={invite.kind} employerName="your QIU employer account" onClose={() => setInvite(null)} onSend={sendInvite} /> : null}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) { return <div><label className="mb-1.5 block text-xs font-semibold text-muted">{label}</label><input required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-12 w-full rounded-[16px] border border-black/10 bg-black/[0.03] px-4 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20" /></div>; }
