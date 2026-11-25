// An alumnus's directory entry: what others may see (nothing until "Show me"), and the mentoring offer.
import { Eye, EyeOff, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiGet, apiWrite, useLoad } from '../api';
import type { Me } from '../auth';
import { LoadError, Notice, SkeletonLines, Spinner, errorText } from '../ui/parts';
import type { Choices, OwnEntry } from './types';

const FIELD_CHOICES: { key: keyof Choices; label: string; value: (e: OwnEntry) => string | number | null }[] = [
  { key: 'show_title', label: 'Job title', value: (e) => e.fields.title },
  { key: 'show_company', label: 'Company', value: (e) => e.fields.company },
  { key: 'show_faculty', label: 'Faculty', value: (e) => e.fields.faculty },
  { key: 'show_year', label: 'Graduation year', value: (e) => e.fields.graduation_year },
];

export function MyEntry({ me }: { me: Me }) {
  const load = useLoad('network-me', () => apiGet<OwnEntry>('/api/network/me'));
  const [fresh, setFresh] = useState<OwnEntry | null>(null);
  const entry = fresh ?? load.data;

  if (load.error && !entry) return <LoadError error={load.error} onRetry={load.reload} />;
  if (!entry) return <div className="panel panel-pad"><SkeletonLines lines={4} /></div>;
  return (
    <div className="net-own">
      <Visibility me={me} entry={entry} onSaved={setFresh} />
      <MentorOffer key={JSON.stringify(entry.mentoring)} me={me} entry={entry} onSaved={setFresh} />
    </div>
  );
}

function Visibility({ me, entry, onSaved }: { me: Me; entry: OwnEntry; onSaved: (e: OwnEntry) => void }) {
  const [choices, setChoices] = useState<Choices>(entry.choices);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const changed = JSON.stringify(choices) !== JSON.stringify(entry.choices);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const saved = await apiWrite<OwnEntry>('PUT', '/api/network/me', choices, me.csrf_token);
      onSaved(saved);
      setMessage({ tone: 'ok', text: saved.choices.visible ? 'Saved. Students and staff can find you.' : 'Saved. You are hidden from the directory.' });
    } catch (failure) {
      setMessage({ tone: 'error', text: errorText(failure) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel panel-pad stack" onSubmit={save} aria-labelledby="vis-h">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="vis-h">Your directory entry</h2>
        {entry.choices.visible ? (
          <span className="badge badge-ok"><Eye size={13} aria-hidden="true" /> Visible</span>
        ) : (
          <span className="badge"><EyeOff size={13} aria-hidden="true" /> Hidden</span>
        )}
      </div>
      <p className="small muted">
        Nobody sees you until you choose to. Your name always links to your LinkedIn profile; tick what else to show.
      </p>
      <label className="check">
        <input type="checkbox" checked={choices.visible} onChange={(e) => setChoices({ ...choices, visible: e.target.checked })} />
        <span><strong>Show me in the alumni directory</strong></span>
      </label>
      <fieldset className="net-fields" disabled={!choices.visible}>
        <legend className="small muted">Also show</legend>
        {FIELD_CHOICES.map(({ key, label, value }) => {
          const current = value(entry);
          return (
            <label key={key} className="check">
              <input type="checkbox" checked={choices[key]} onChange={(e) => setChoices({ ...choices, [key]: e.target.checked })} />
              <span>
                {label}
                <span className="small muted"> · {current ?? 'not in your profile yet'}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <button type="submit" className="btn btn-primary" disabled={saving || !changed} style={{ justifySelf: 'start' }}>
        {saving && <Spinner />}Save choices
      </button>
    </form>
  );
}

function MentorOffer({ me, entry, onSaved }: { me: Me; entry: OwnEntry; onSaved: (e: OwnEntry) => void }) {
  const offer = entry.mentoring;
  const [topics, setTopics] = useState<string[]>(offer?.topics ?? []);
  const [topic, setTopic] = useState('');
  const [slots, setSlots] = useState(offer?.slots_per_month ?? 2);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const addTopic = () => {
    const clean = topic.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (clean.length >= 2 && topics.length < 6 && !topics.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setTopics([...topics, clean]);
    }
    setTopic('');
  };

  async function save(active: boolean) {
    if (active && topics.length === 0) {
      setMessage({ tone: 'error', text: 'Add at least one topic you can help with.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const saved = await apiWrite<OwnEntry>('PUT', '/api/network/mentoring', {
        active,
        topics: topics.length ? topics : (offer?.topics ?? ['General']),
        slots_per_month: slots,
      }, me.csrf_token);
      onSaved(saved);
    } catch (failure) {
      setMessage({ tone: 'error', text: errorText(failure) });
    } finally {
      setSaving(false);
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save(true);
  };

  return (
    <form className="panel panel-pad stack" onSubmit={submit} aria-labelledby="offer-h" noValidate>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="offer-h">Mentoring</h2>
        {offer?.active ? <span className="badge badge-ok">Offering</span> : <span className="badge">Not offering</span>}
      </div>
      <p className="small muted">
        Students can ask you for advice. You choose how many you take each month and accept or decline each one.
        {!entry.choices.visible && ' Students find mentors in the directory, so show yourself there too.'}
      </p>
      <div className="field">
        <label htmlFor="offer-topic">Topics you can help with</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input
            id="offer-topic"
            className="input"
            placeholder="For example: CV review"
            value={topic}
            maxLength={40}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTopic();
              }
            }}
          />
          <button type="button" className="btn" onClick={addTopic} disabled={topics.length >= 6}>
            <Plus size={16} aria-hidden="true" /> Add
          </button>
        </div>
        <span className="hint">Up to 6 topics.</span>
      </div>
      {topics.length > 0 && (
        <ul className="chips" aria-label="Your topics">
          {topics.map((t) => (
            <li key={t} className="chip">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => setTopics(topics.filter((x) => x !== t))}>
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="field" style={{ maxWidth: 220 }}>
        <label htmlFor="offer-slots">Students per month</label>
        <select id="offer-slots" className="select" value={slots} onChange={(e) => setSlots(Number(e.target.value))}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving && <Spinner />}{offer?.active ? 'Save mentoring' : 'Offer mentoring'}
        </button>
        {offer?.active && (
          <button type="button" className="btn btn-quiet" disabled={saving} onClick={() => void save(false)}>
            Pause mentoring
          </button>
        )}
      </div>
    </form>
  );
}
