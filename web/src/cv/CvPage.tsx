// CV builder: the career profile plus what the CV adds, saved on the server, printed or saved as PDF by the browser.
import { Plus, Printer, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { apiGet, apiWrite, useLoad } from '../api';
import type { Me } from '../auth';
import { monthLabel } from '../profile/types';
import { PageHead } from '../shell/Shell';
import { LoadError, Notice, SkeletonLines, Spinner, errorText } from '../ui/parts';
import { CvPreview } from './CvPreview';
import { SECTION_IDEAS, blankItem, cvProblem, type CvContent, type CvItem, type CvResponse } from './types';
import './cv.css';

export function CvPage({ me, go }: { me: Me; go: (to: string) => void }) {
  const load = useLoad('cv', () => apiGet<CvResponse>('/api/cv'));
  // Print styles show only the sheet while this page is open.
  useEffect(() => {
    document.body.classList.add('cv-page');
    return () => document.body.classList.remove('cv-page');
  }, []);

  if (load.error && !load.data) {
    return (
      <>
        <PageHead title="CV builder" />
        <LoadError error={load.error} onRetry={load.reload} />
      </>
    );
  }
  if (!load.data) return <SkeletonLines lines={6} />;
  return <CvEditor key={load.data.saved_at ?? 'new'} data={load.data} csrf={me.csrf_token} go={go} />;
}

function CvEditor({ data, csrf, go }: { data: CvResponse; csrf: string; go: (to: string) => void }) {
  const [cv, setCv] = useState<CvContent>(data.cv);
  const [savedAt, setSavedAt] = useState(data.saved_at);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const profile = data.profile;

  const change = (next: CvContent) => {
    setCv(next);
    setDirty(true);
    setMessage(null);
  };
  const setContact = (name: keyof CvContent['contact'], value: string) => change({ ...cv, contact: { ...cv.contact, [name]: value } });
  const toggle = (list: 'hidden_experience' | 'hidden_education', id: number, shown: boolean) =>
    change({ ...cv, [list]: shown ? cv[list].filter((x) => x !== id) : [...cv[list], id] });
  const setSection = (index: number, patch: Partial<CvContent['sections'][number]>) =>
    change({ ...cv, sections: cv.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  const setItem = (si: number, ii: number, patch: Partial<CvItem>) =>
    setSection(si, { items: cv.sections[si].items.map((item, j) => (j === ii ? { ...item, ...patch } : item)) });
  const addSection = (title: string) => change({ ...cv, sections: [...cv.sections, { title, items: [{ ...blankItem }] }] });

  async function save(event: FormEvent) {
    event.preventDefault();
    const problem = cvProblem(cv);
    if (problem) {
      setMessage({ tone: 'error', text: problem });
      return;
    }
    setSaving(true);
    try {
      const saved = await apiWrite<CvResponse>('PUT', '/api/cv', cv, csrf);
      setCv(saved.cv);
      setSavedAt(saved.saved_at);
      setDirty(false);
      setMessage({ tone: 'ok', text: 'Your CV is saved.' });
    } catch (error) {
      setMessage({ tone: 'error', text: errorText(error) });
    } finally {
      setSaving(false);
    }
  }

  const unused = SECTION_IDEAS.filter((idea) => !cv.sections.some((s) => s.title.toLowerCase() === idea.toLowerCase()));
  return (
    <>
      <PageHead
        title="CV builder"
        actions={
          <button type="button" className="btn" onClick={() => window.print()}>
            <Printer size={17} aria-hidden="true" /> Print or save as PDF
          </button>
        }
      >
        Your jobs, education and skills come from your career profile. Add the rest here; it is saved to your account.
      </PageHead>
      <div className="cv-layout">
        <form className="panel panel-pad cv-editor stack" onSubmit={save} noValidate>
          <section className="stack" aria-labelledby="cv-top-h">
            <h2 id="cv-top-h">Top of the CV</h2>
            <div className="field">
              <label htmlFor="cv-headline">Headline</label>
              <input id="cv-headline" className="input" maxLength={300} value={cv.headline} onChange={(e) => change({ ...cv, headline: e.target.value })} placeholder="Final-year Data Science student" />
            </div>
            <div className="cv-grid">
              <div className="field">
                <label htmlFor="cv-email">Email</label>
                <input id="cv-email" type="email" className="input" maxLength={254} value={cv.contact.email} onChange={(e) => setContact('email', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="cv-phone">Phone</label>
                <input id="cv-phone" type="tel" className="input" maxLength={40} value={cv.contact.phone} onChange={(e) => setContact('phone', e.target.value)} placeholder="+60 12-345 6789" />
              </div>
              <div className="field">
                <label htmlFor="cv-location">Location</label>
                <input id="cv-location" className="input" maxLength={200} value={cv.contact.location} onChange={(e) => setContact('location', e.target.value)} placeholder="Ipoh, Perak" />
              </div>
              <div className="field">
                <label htmlFor="cv-site">Website or portfolio</label>
                <input id="cv-site" type="url" className="input" maxLength={300} value={cv.contact.website} onChange={(e) => setContact('website', e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div className="field">
              <label htmlFor="cv-summary">Profile summary</label>
              <textarea id="cv-summary" className="textarea" rows={4} maxLength={3000} value={cv.summary} onChange={(e) => change({ ...cv, summary: e.target.value })} />
              <span className="hint">Three or four lines: what you do, what you are good at, what you look for.</span>
            </div>
          </section>

          <section className="stack cv-rule" aria-labelledby="cv-from-h">
            <div className="cv-head">
              <h2 id="cv-from-h">From your career profile</h2>
              <a href="/profile" className="small" onClick={(e) => { e.preventDefault(); go('/profile'); }}>Edit profile</a>
            </div>
            {profile.experience.length === 0 && profile.education.length === 0 && (
              <Notice>Your profile has no jobs or education yet. Add them on My profile, or import your LinkedIn PDF there.</Notice>
            )}
            {profile.experience.map((job) => (
              <label key={job.id} className="check">
                <input type="checkbox" checked={!cv.hidden_experience.includes(job.id)} onChange={(e) => toggle('hidden_experience', job.id, e.target.checked)} />
                <span>
                  {job.title}, {job.company}
                  <span className="small muted"> {[monthLabel(job.start), job.start ? monthLabel(job.end, true) : ''].filter(Boolean).join(' to ')}</span>
                </span>
              </label>
            ))}
            {profile.education.map((s) => (
              <label key={s.id} className="check">
                <input type="checkbox" checked={!cv.hidden_education.includes(s.id)} onChange={(e) => toggle('hidden_education', s.id, e.target.checked)} />
                <span>{[s.school, s.degree].filter(Boolean).join(', ')}</span>
              </label>
            ))}
            <label className="check">
              <input type="checkbox" checked={cv.show_skills} onChange={(e) => change({ ...cv, show_skills: e.target.checked })} />
              <span>Skills ({profile.skills.length})</span>
            </label>
          </section>

          <section className="stack cv-rule" aria-labelledby="cv-extra-h">
            <h2 id="cv-extra-h">Extra sections</h2>
            {cv.sections.map((section, si) => (
              <div key={si} className="cv-section">
                <div className="cv-head">
                  <div className="field cv-grow">
                    <label htmlFor={`cv-s-${si}`}>Section title</label>
                    <input id={`cv-s-${si}`} className="input" maxLength={80} value={section.title} onChange={(e) => setSection(si, { title: e.target.value })} />
                  </div>
                  <button type="button" className="btn btn-quiet btn-small" onClick={() => change({ ...cv, sections: cv.sections.filter((_, i) => i !== si) })} aria-label={`Remove section ${section.title}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
                {section.items.map((item, ii) => (
                  <div key={ii} className="cv-item">
                    <div className="cv-grid">
                      <div className="field">
                        <label htmlFor={`cv-h-${si}-${ii}`}>Heading</label>
                        <input id={`cv-h-${si}-${ii}`} className="input" maxLength={200} value={item.heading} onChange={(e) => setItem(si, ii, { heading: e.target.value })} />
                      </div>
                      <div className="field">
                        <label htmlFor={`cv-p-${si}-${ii}`}>When</label>
                        <input id={`cv-p-${si}-${ii}`} className="input" maxLength={60} value={item.period} onChange={(e) => setItem(si, ii, { period: e.target.value })} placeholder="2026" />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor={`cv-u-${si}-${ii}`}>Organisation or role</label>
                      <input id={`cv-u-${si}-${ii}`} className="input" maxLength={200} value={item.sub} onChange={(e) => setItem(si, ii, { sub: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`cv-d-${si}-${ii}`}>Details</label>
                      <textarea id={`cv-d-${si}-${ii}`} className="textarea" rows={2} maxLength={1500} value={item.detail} onChange={(e) => setItem(si, ii, { detail: e.target.value })} />
                    </div>
                    <button type="button" className="btn btn-quiet btn-small cv-remove" onClick={() => setSection(si, { items: section.items.filter((_, j) => j !== ii) })}>
                      <X size={15} aria-hidden="true" /> Remove entry
                    </button>
                  </div>
                ))}
                {section.items.length < 20 && (
                  <button type="button" className="btn btn-small" onClick={() => setSection(si, { items: [...section.items, { ...blankItem }] })}>
                    <Plus size={15} aria-hidden="true" /> Add entry
                  </button>
                )}
              </div>
            ))}
            {cv.sections.length < 10 && (
              <div className="row cv-ideas">
                {unused.map((idea) => (
                  <button key={idea} type="button" className="btn btn-small" onClick={() => addSection(idea)}>
                    <Plus size={15} aria-hidden="true" /> {idea}
                  </button>
                ))}
                <button type="button" className="btn btn-quiet btn-small" onClick={() => addSection('')}>
                  <Plus size={15} aria-hidden="true" /> Other section
                </button>
              </div>
            )}
          </section>

          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <div className="row cv-save">
            <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>
              {saving && <Spinner size={14} />}Save CV
            </button>
            <span className="small muted">{dirty ? 'Unsaved changes' : savedAt ? 'All changes saved' : 'Not saved yet'}</span>
          </div>
        </form>
        <div className="cv-paper">
          <CvPreview profile={profile} cv={cv} />
        </div>
      </div>
    </>
  );
}
