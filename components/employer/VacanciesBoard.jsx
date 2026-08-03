'use client';

import { useCallback, useEffect, useState } from 'react';
import { BriefcaseBusiness, PlusCircle, Users, Loader2, MapPin, ChevronRight } from 'lucide-react';
import { applyToJob, fetchJobs, publishJob, fetchApplicants, setApplicationStage } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';

const STAGES = ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'REJECTED'];
const STAGE_STYLE = {
  APPLIED: 'bg-black/[0.04] text-[#424245] border-black/10',
  SHORTLISTED: 'bg-sky-50 text-sky-700 border-sky-200',
  INTERVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  OFFER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-crimson/10 text-crimson border-crimson/25',
};

/**
 * Employer vacancy board (Module 11). Posting a job persists to the database
 * (Company + JobPosting), so a refresh no longer wipes it, and each posting's
 * applicants move through the ATS stages — also persisted.
 */
export default function VacanciesBoard({ currentRole }) {
  const canManage = ['EMPLOYER', 'CPDC_ADMIN', 'SUPER_ADMIN'].includes(currentRole);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', company: '', location: '', type: 'Internship', skills: '', description: '' });
  const [posting, setPosting] = useState(false);
  const [openJobId, setOpenJobId] = useState(null);
  const [applicants, setApplicants] = useState({}); // jobId -> [applications]
  const [applyingId, setApplyingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { jobs: list } = await fetchJobs(currentRole);
      setJobs(Array.isArray(list) ? list : []);
      setError('');
    } catch (e) {
      setError(e.message || 'Could not load vacancies.');
    } finally {
      setLoading(false);
    }
  }, [currentRole]);

  useEffect(() => { load(); }, [load]);

  const post = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.company.trim() || !form.description.trim() || posting) return;
    setPosting(true);
    try {
      await publishJob({
        title: form.title,
        description: form.description,
        location: form.location || null,
        type: form.type || null,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        company: { name: form.company },
      }, currentRole);
      setForm({ title: '', company: '', location: '', type: 'Internship', skills: '', description: '' });
      await load();
    } catch (e) {
      setError(e.message || 'Could not publish the vacancy.');
    } finally {
      setPosting(false);
    }
  };

  const toggleApplicants = async (jobId) => {
    if (openJobId === jobId) { setOpenJobId(null); return; }
    setOpenJobId(jobId);
    try {
      const { applications } = await fetchApplicants(jobId, currentRole);
      setApplicants((prev) => ({ ...prev, [jobId]: applications ?? [] }));
    } catch (e) {
      setError(e.message || 'Could not load applicants.');
    }
  };

  const advance = async (jobId, applicationId, stage) => {
    try {
      await setApplicationStage(applicationId, stage, currentRole);
      setApplicants((prev) => ({
        ...prev,
        [jobId]: (prev[jobId] ?? []).map((a) => (a.id === applicationId ? { ...a, stage } : a)),
      }));
    } catch (e) {
      setError(e.message || 'Could not update the stage.');
    }
  };

  const apply = async (jobId) => {
    if (applyingId) return;
    setApplyingId(jobId);
    try {
      const data = await applyToJob(jobId);
      setJobs((previous) => previous.map((job) => (
        job.id === jobId
          ? { ...job, applied: true, myStage: data?.application?.stage ?? 'APPLIED' }
          : job
      )));
    } catch (e) {
      setError(e.message || 'Could not apply to the vacancy.');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Post a vacancy — employer/admin only. Students and alumni use the
          same persisted board to apply, never to create postings. */}
      {canManage && <div className="lg:col-span-5">
        <div className="surface p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-black/10 pb-4">
            <PlusCircle className="h-5 w-5 text-crimson" />
            <h2 className="font-heading text-lg font-semibold">Post a vacancy</h2>
          </div>
          <form onSubmit={post} className="space-y-3">
            <label htmlFor="vacancy-title" className="block"><span className="field-label">Role title</span><input id="vacancy-title" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Software Engineering Intern" className="text-input" /></label>
            <label htmlFor="vacancy-company" className="block"><span className="field-label">Company name</span><input id="vacancy-company" required value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="The employer or organisation" className="text-input" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label htmlFor="vacancy-location" className="block"><span className="field-label">Location</span><input id="vacancy-location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Ipoh, remote or hybrid" className="text-input" /></label>
              <label htmlFor="vacancy-type" className="block"><span className="field-label">Opportunity type</span><select id="vacancy-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="text-input">
                <option>Internship</option><option>Graduate</option><option>Part-time</option>
              </select></label>
            </div>
            <label htmlFor="vacancy-skills" className="block"><span className="field-label">Skills</span><input id="vacancy-skills" value={form.skills} onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))} placeholder="Python, SQL, communication" className="text-input" /><span className="mt-1 block text-xs text-muted">Separate skills with commas.</span></label>
            <label htmlFor="vacancy-description" className="block"><span className="field-label">Role description and requirements</span><textarea id="vacancy-description" required rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What will the student do, and what should they bring?" className="text-input h-auto py-3" /></label>
            <button type="submit" disabled={posting} className="crimson-btn w-full justify-center disabled:opacity-60">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              {posting ? 'Publishing…' : 'Publish vacancy'}
            </button>
          </form>
        </div>
      </div>}

      {/* Live postings */}
      <div className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3`}>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-crimson" /> {canManage ? 'Open vacancies' : 'Live opportunities'}</h2>
          <span className="text-xs text-muted">{jobs.length} live · saved to database</span>
        </div>
        {error && <div className="rounded-[14px] border border-crimson/25 bg-crimson/[0.05] px-4 py-3 text-sm font-semibold text-crimson" role="alert">{error}</div>}
        {loading ? (
          <div className="surface flex items-center justify-center gap-2 p-10 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="surface p-10 text-center text-sm text-muted">No vacancies yet — post one and it will persist across refreshes.</div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="surface p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-heading font-semibold">{job.title}</h3>
                  <p className="text-xs text-muted">{job.company?.name}{job.type ? ` · ${job.type}` : ''}</p>
                  {job.location && <p className="text-xs text-muted flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" /> {job.location}</p>}
                </div>
                {canManage ? (
                  <button type="button" onClick={() => toggleApplicants(job.id)} className="secondary-btn text-xs shrink-0">
                    <Users className="h-3.5 w-3.5" /> {job.applicantCount} applicant{job.applicantCount === 1 ? '' : 's'}
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${openJobId === job.id ? 'rotate-90' : ''}`} />
                  </button>
                ) : (
                  <button type="button" onClick={() => apply(job.id)} disabled={job.applied || applyingId === job.id} className={`secondary-btn text-xs shrink-0 ${job.applied ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}`}>
                    {applyingId === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BriefcaseBusiness className="h-3.5 w-3.5" />}
                    {job.applied ? `Applied · ${job.myStage ?? 'APPLIED'}` : applyingId === job.id ? 'Applying…' : 'Apply now'}
                  </button>
                )}
              </div>
              <p className="text-sm text-muted line-clamp-2">{job.description}</p>
              {job.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {job.skills.map((s) => <span key={s} className="badge-pill bg-black/[0.03] text-[#424245] border border-black/10">{s}</span>)}
                </div>
              )}
              {canManage && openJobId === job.id && (
                <div className="border-t border-black/[0.06] pt-3 space-y-2">
                  {(applicants[job.id] ?? []).length === 0 ? (
                    <p className="text-xs text-muted">No applicants yet.</p>
                  ) : (
                    applicants[job.id].map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3 flex-wrap">
                        <Avatar name={a.studentName} src={a.studentAvatar} size={36} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1d1d1f]">{a.studentName}</p>
                          <p className="text-[11px] text-muted">{a.programme ?? '—'} · {a.studentEmail}</p>
                        </div>
                        <select
                          value={a.stage}
                          onChange={(e) => advance(job.id, a.id, e.target.value)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STAGE_STYLE[a.stage] ?? STAGE_STYLE.APPLIED}`}
                        >
                          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
