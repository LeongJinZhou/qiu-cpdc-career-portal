// My profile: who I am at QIU, my linked accounts, LinkedIn PDF import and my career details.
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { apiGet, useLoad } from '../api';
import { ROLE_LABEL, type Me } from '../auth';
import { LINK_RESULTS } from '../auth/linkedinResult';
import { Avatar, LoadError, SkeletonLines } from '../ui/parts';
import { CareerForm } from './CareerForm';
import { JobConfirm } from './JobConfirm';
import { LinkedAccounts } from './LinkedAccounts';
import { PdfImport } from './PdfImport';
import './profile.css';
import type { Profile } from './types';

export function ProfilePage({
  me,
  linkResult,
  githubResult,
  onMeChanged,
}: {
  me: Me;
  linkResult: string | null;
  githubResult: string | null;
  onMeChanged: () => void;
}) {
  const load = useLoad('profile', () => apiGet<Profile>('/api/profile'));
  const [fresh, setFresh] = useState<Profile | null>(null);
  // A PDF import replaces the form's lists: a new version remounts the form with them.
  const [version, setVersion] = useState(0);
  const profile = fresh ?? load.data;

  if (load.error && !profile) return <LoadError error={load.error} onRetry={load.reload} />;
  if (!profile) return <SkeletonLines lines={6} />;

  const where = [profile.faculty ?? profile.department, profile.programme].filter(Boolean).join(' · ');
  const id = profile.matric_no ?? profile.employee_id;
  return (
    <>
      <div className="profile-head">
        <Avatar name={profile.display_name} src={profile.picture_url} size={72} />
        <div>
          <h1>{profile.display_name}</h1>
          <div className="meta">
            <span>{ROLE_LABEL[me.user.role]}{id ? ` · ${id}` : ''}</span>
            {where && <span>{where}</span>}
            {profile.linkedin_url && (
              <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">
                LinkedIn profile <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>
      {me.job_confirmation_due && (
        <JobConfirm profile={profile} csrf={me.csrf_token} onDone={() => { onMeChanged(); load.reload(); setFresh(null); }} />
      )}
      <div className="profile-grid">
        <CareerForm key={`${profile.id}-${version}`} profile={profile} csrf={me.csrf_token} onSaved={setFresh} />
        <div className="side-stack">
          <LinkedAccounts
            me={me}
            profile={profile}
            linkResult={linkResult ? LINK_RESULTS[linkResult] : undefined}
            githubResult={githubResult}
            onChanged={() => { setFresh(null); load.reload(); }}
          />
          <PdfImport csrf={me.csrf_token} onSaved={(p) => { setFresh(p); setVersion((v) => v + 1); }} />
        </div>
      </div>
    </>
  );
}
