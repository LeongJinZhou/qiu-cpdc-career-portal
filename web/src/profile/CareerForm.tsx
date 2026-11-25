// The editable career profile: details, current job, jobs, education and skills. One Save for all of it.
import { Plus, Trash2, X } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { apiWrite } from '../api';
import { Notice, Spinner, errorText } from '../ui/parts';
import { STATUS_LABEL, type EmploymentStatus, type Job, type Profile, type School } from './types';

type Fields = {
  headline: string;
  about: string;
  location: string;
  industry: string;
  personal_email: string;
  programme: string;
  graduation_year: string;
  employment_status: EmploymentStatus;
  current_title: string;
  current_company: string;
  current_since: string;
};

function fieldsOf(p: Profile): Fields {
  return {
    headline: p.headline ?? '',
    about: p.about ?? '',
    location: p.location ?? '',
    industry: p.industry ?? '',
    personal_email: p.personal_email ?? '',
    programme: p.programme ?? '',
    graduation_year: p.graduation_year ? String(p.graduation_year) : '',
    employment_status: p.employment_status,
    current_title: p.current_title ?? '',
    current_company: p.current_company ?? '',
    current_since: p.current_since ? p.current_since.slice(0, 7) : '',
  };
}

const jobsOf = (p: Profile): Job[] =>
  p.experience.map((j) => ({
    title: j.title, company: j.company, location: j.location, start: j.start, end: j.end, description: j.description,
  }));
const schoolsOf = (p: Profile): School[] =>
  p.education.map((s) => ({ school: s.school, degree: s.degree, field: s.field, start_year: s.start_year, end_year: s.end_year }));

const blankJob: Job ={ title: '', company: '', location: null, start: null, end: null, description: null };
const blankSchool: School = { school: '', degree: null, field: null, start_year: null, end_year: null };

export function CareerForm({ profile, csrf, onSaved }: { profile: Profile; csrf: string; onSaved: (p: Profile) => void }) {
  const [fields, setFields] = useState<Fields>(() => fieldsOf(profile));
  const [jobs, setJobs] = useState<Job[]>(() => jobsOf(profile));
  const [schools, setSchools] = useState<School[]>(() => schoolsOf(profile));
  const [skills, setSkills] = useState<string[]>(profile.skills);
  const [skillDraft, setSkillDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const touch = () => {
    setDirty(true);
    setMessage(null);
  };
  const setField = <K extends keyof Fields>(name: K, value: Fields[K]) => {
    setFields((f) => ({ ...f, [name]: value }));
    touch();
  };
  const setJob = (index: number, patch: Partial<Job>) => {
    setJobs((list) => list.map((job, i) => (i === index ? { ...job, ...patch } : job)));
    touch();
  };
  const setSchool = (index: number, patch: Partial<School>) => {
    setSchools((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    touch();
  };
  const addSkill = () => {
    const skill = skillDraft.trim();
    if (skill && !skills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      setSkills([...skills, skill].slice(0, 50));
      touch();
    }
    setSkillDraft('');
  };
  const onSkillKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkill();
    }
  };

  function reset() {
    setFields(fieldsOf(profile));
    setJobs(jobsOf(profile));
    setSchools(schoolsOf(profile));
    setSkills(profile.skills);
    setDirty(false);
    setMessage(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const year = fields.graduation_year.trim();
    if (year && !/^(19|20)\d\d$/.test(year)) {
      setMessage({ tone: 'error', text: 'Graduation year must be a year, like 2026.' });
      return;
    }
    const incomplete = jobs.findIndex((j) => !j.title.trim() || !j.company.trim());
    if (incomplete >= 0) {
      setMessage({ tone: 'error', text: `Job ${incomplete + 1} needs a title and a company.` });
      return;
    }
    if (schools.some((s) => !s.school.trim())) {
      setMessage({ tone: 'error', text: 'Every education entry needs a school name.' });
      return;
    }
    setSaving(true);
    try {
      const saved = await apiWrite<Profile>('PUT', '/api/profile', {
        source: 'manual',
        fields: { ...fields, graduation_year: year ? Number(year) : null },
        experience: jobs.map((j) => ({ ...j, title: j.title.trim(), company: j.company.trim() })),
        education: schools.map((s) => ({ ...s, school: s.school.trim() })),
        skills,
      }, csrf);
      onSaved(saved);
      setDirty(false);
      setMessage({ tone: 'ok', text: 'Your profile is saved.' });
    } catch (error) {
      setMessage({ tone: 'error', text: errorText(error) });
    } finally {
      setSaving(false);
    }
  }

  const showJob = fields.employment_status === 'employed' || fields.employment_status === 'self_employed';
  return (
    <form className="panel panel-pad" onSubmit={save} noValidate>
      <section className="section" aria-labelledby="about-h">
        <h2 id="about-h">About you</h2>
        <Text id="headline" label="Headline" value={fields.headline} onChange={(v) => setField('headline', v)} placeholder="Final-year Computer Science student" />
        <div className="field">
          <label htmlFor="about">About</label>
          <textarea id="about" className="textarea" value={fields.about} maxLength={5000} onChange={(e) => setField('about', e.target.value)} />
        </div>
        <div className="grid-2">
          <Text id="location" label="Location" value={fields.location} onChange={(v) => setField('location', v)} placeholder="Ipoh, Malaysia" />
          <Text id="industry" label="Industry" value={fields.industry} onChange={(v) => setField('industry', v)} />
          <Text id="programme" label="Programme" value={fields.programme} onChange={(v) => setField('programme', v)} />
          <Text id="grad-year" label="Graduation year" value={fields.graduation_year} onChange={(v) => setField('graduation_year', v)} inputMode="numeric" placeholder="2026" />
        </div>
        <Text
          id="personal-email"
          label="Personal email"
          value={fields.personal_email}
          onChange={(v) => setField('personal_email', v)}
          type="email"
          hint="Not your QIU email: it closes when you graduate. CPDC uses this one to reach you later."
        />
      </section>

      <section className="section" aria-labelledby="now-h">
        <h2 id="now-h">What you do now</h2>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" className="select" value={fields.employment_status} onChange={(e) => setField('employment_status', e.target.value as EmploymentStatus)}>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        {(showJob || fields.employment_status === 'further_study') && (
          <div className="grid-2">
            <Text id="cur-title" label={showJob ? 'Job title' : 'Course'} value={fields.current_title} onChange={(v) => setField('current_title', v)} />
            <Text id="cur-company" label={showJob ? 'Company' : 'University'} value={fields.current_company} onChange={(v) => setField('current_company', v)} />
            <Text id="cur-since" label="Since" value={fields.current_since} onChange={(v) => setField('current_since', v)} type="month" />
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="exp-h">
        <div className="section-head">
          <h2 id="exp-h">Experience</h2>
          <button type="button" className="btn btn-small" onClick={() => { setJobs([...jobs, blankJob]); touch(); }} disabled={jobs.length >= 30}>
            <Plus size={15} aria-hidden="true" /> Add job
          </button>
        </div>
        {jobs.length === 0 && <p className="muted small">No jobs or internships yet. Add one, or import your LinkedIn PDF.</p>}
        {jobs.map((job, i) => (
          <fieldset key={i} className="entry" style={{ margin: 0 }}>
            <div className="entry-head">
              <legend className="small muted" style={{ padding: 0 }}>Job {i + 1}</legend>
              <button type="button" className="btn btn-quiet btn-small" onClick={() => { setJobs(jobs.filter((_, n) => n !== i)); touch(); }} aria-label={`Remove job ${i + 1}`}>
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="grid-2">
              <Text id={`job-${i}-title`} label="Title" value={job.title} onChange={(v) => setJob(i, { title: v })} />
              <Text id={`job-${i}-company`} label="Company" value={job.company} onChange={(v) => setJob(i, { company: v })} />
              <Text id={`job-${i}-start`} label="From" type="month" value={job.start ?? ''} onChange={(v) => setJob(i, { start: v || null })} />
              <Text id={`job-${i}-end`} label="To (empty if current)" type="month" value={job.end ?? ''} onChange={(v) => setJob(i, { end: v || null })} />
            </div>
            <Text id={`job-${i}-loc`} label="Location" value={job.location ?? ''} onChange={(v) => setJob(i, { location: v || null })} />
            <div className="field">
              <label htmlFor={`job-${i}-desc`}>What you did</label>
              <textarea id={`job-${i}-desc`} className="textarea" style={{ minHeight: 80 }} maxLength={2000} value={job.description ?? ''} onChange={(e) => setJob(i, { description: e.target.value || null })} />
            </div>
          </fieldset>
        ))}
      </section>

      <section className="section" aria-labelledby="edu-h">
        <div className="section-head">
          <h2 id="edu-h">Education</h2>
          <button type="button" className="btn btn-small" onClick={() => { setSchools([...schools, blankSchool]); touch(); }} disabled={schools.length >= 20}>
            <Plus size={15} aria-hidden="true" /> Add school
          </button>
        </div>
        {schools.map((s, i) => (
          <fieldset key={i} className="entry" style={{ margin: 0 }}>
            <div className="entry-head">
              <legend className="small muted" style={{ padding: 0 }}>School {i + 1}</legend>
              <button type="button" className="btn btn-quiet btn-small" onClick={() => { setSchools(schools.filter((_, n) => n !== i)); touch(); }} aria-label={`Remove school ${i + 1}`}>
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="grid-2">
              <Text id={`edu-${i}-school`} label="School" value={s.school} onChange={(v) => setSchool(i, { school: v })} />
              <Text id={`edu-${i}-degree`} label="Degree" value={s.degree ?? ''} onChange={(v) => setSchool(i, { degree: v || null })} />
              <Text id={`edu-${i}-from`} label="From year" inputMode="numeric" value={s.start_year ? String(s.start_year) : ''} onChange={(v) => setSchool(i, { start_year: /^\d{4}$/.test(v) ? Number(v) : null })} />
              <Text id={`edu-${i}-to`} label="To year" inputMode="numeric" value={s.end_year ? String(s.end_year) : ''} onChange={(v) => setSchool(i, { end_year: /^\d{4}$/.test(v) ? Number(v) : null })} />
            </div>
          </fieldset>
        ))}
      </section>

      <section className="section" aria-labelledby="skills-h">
        <h2 id="skills-h">Skills</h2>
        {skills.length > 0 && (
          <ul className="chips" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {skills.map((skill) => (
              <li key={skill} className="chip">
                {skill}
                <button type="button" aria-label={`Remove ${skill}`} onClick={() => { setSkills(skills.filter((s) => s !== skill)); touch(); }}>
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="row">
          <input className="input" style={{ flex: '1 1 200px', width: 'auto' }} aria-label="Add a skill" placeholder="Add a skill and press Enter" value={skillDraft} maxLength={80} onChange={(e) => setSkillDraft(e.target.value)} onKeyDown={onSkillKey} />
          <button type="button" className="btn" onClick={addSkill}>Add</button>
        </div>
      </section>

      {message && !dirty && <div style={{ marginTop: 18 }}><Notice tone={message.tone}>{message.text}</Notice></div>}
      {dirty && (
        <div className="savebar" role="region" aria-label="Unsaved changes">
          <span className="small">{message?.tone === 'error' ? message.text : 'You have unsaved changes.'}</span>
          <div className="row">
            <button type="button" className="btn btn-quiet btn-small" onClick={reset}>Undo</button>
            <button type="submit" className="btn btn-primary btn-small" disabled={saving}>
              {saving && <Spinner size={14} />}
              Save profile
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function Text(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'month';
  hint?: string;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        className="input"
        type={props.type ?? 'text'}
        value={props.value}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        aria-describedby={props.hint ? `${props.id}-hint` : undefined}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && <span className="hint" id={`${props.id}-hint`}>{props.hint}</span>}
    </div>
  );
}
