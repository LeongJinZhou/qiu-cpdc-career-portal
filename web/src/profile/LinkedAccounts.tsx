// LinkedIn and GitHub links on the profile (docs/SPEC.md rules 6 and 12): change the URL, re-link, link GitHub.
import { ExternalLink, Pencil } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiFailure, apiPatch } from '../api';
import type { Me } from '../auth';
import { LinkedInMark } from '../auth/ProviderMarks';
import { Notice, Spinner, errorText } from '../ui/parts';
import type { Profile } from './types';

const GITHUB_RESULTS: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  linked: { tone: 'ok', text: 'GitHub is linked.' },
  'in-use': { tone: 'error', text: 'That GitHub account is linked to another person.' },
  off: { tone: 'error', text: 'GitHub linking is not switched on.' },
  failed: { tone: 'error', text: 'Linking GitHub did not finish. Please try again.' },
};

export function LinkedAccounts({
  me,
  profile,
  linkResult,
  githubResult,
  onChanged,
}: {
  me: Me;
  profile: Profile;
  linkResult: { tone: 'ok' | 'error'; text: string } | undefined;
  githubResult: string | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(profile.linkedin_url ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const github = githubResult ? GITHUB_RESULTS[githubResult] : undefined;

  async function saveUrl(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiPatch('/api/profile/linkedin-url', { profile_url: url.trim() }, me.csrf_token);
      setEditing(false);
      onChanged();
    } catch (failure) {
      setError(failure instanceof ApiFailure && failure.status === 400 ? failure.detail : errorText(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel panel-pad stack" aria-labelledby="accounts-h">
      <h2 id="accounts-h">Linked accounts</h2>
      {linkResult && <Notice tone={linkResult.tone}>{linkResult.text}</Notice>}
      <div className="stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="row" style={{ gap: 8 }}>
            <LinkedInMark />
            <strong>LinkedIn</strong>
          </span>
          {profile.linkedin_linked ? <span className="badge badge-ok">Linked</span> : <span className="badge badge-warn">Not linked</span>}
        </div>
        {!editing && profile.linkedin_url && (
          <a className="small" href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>
            {profile.linkedin_url.replace('https://www.', '')} <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
        {editing ? (
          <form className="stack" onSubmit={saveUrl} style={{ gap: 10 }} noValidate>
            <div className="field">
              <label htmlFor="li-url">Profile link</label>
              <input id="li-url" className="input" inputMode="url" value={url} aria-invalid={error ? true : undefined} onChange={(e) => setUrl(e.target.value)} />
              {error && <span className="error">{error}</span>}
            </div>
            <div className="row">
              <button type="submit" className="btn btn-primary btn-small" disabled={saving}>
                {saving && <Spinner size={14} />}Save link
              </button>
              <button type="button" className="btn btn-quiet btn-small" onClick={() => { setEditing(false); setUrl(profile.linkedin_url ?? ''); setError(null); }}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="row">
            {profile.linkedin_linked && (
              <button type="button" className="btn btn-small" onClick={() => setEditing(true)}>
                <Pencil size={14} aria-hidden="true" /> Change link
              </button>
            )}
            {me.features.linkedin && (
              <a className="btn btn-small" href="/api/auth/linkedin/start?mode=link&return=/profile">
                {profile.linkedin_linked ? 'Switch LinkedIn account' : 'Link LinkedIn'}
              </a>
            )}
          </div>
        )}
      </div>
      {(me.features.github || profile.github_url) && (
        <div className="stack" style={{ gap: 10, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          {github && <Notice tone={github.tone}>{github.text}</Notice>}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>GitHub</strong>
            <span className="badge">{profile.github_url ? 'Linked' : 'Optional'}</span>
          </div>
          {profile.github_url && (
            <a className="small" href={profile.github_url} target="_blank" rel="noopener noreferrer">
              {profile.github_url.replace('https://', '')} <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
          {me.features.github && (
            <a className="btn btn-small" href="/api/auth/github/start" style={{ justifySelf: 'start' }}>
              {profile.github_url ? 'Switch GitHub account' : 'Link GitHub'}
            </a>
          )}
        </div>
      )}
    </section>
  );
}
