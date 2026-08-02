'use client';

import { useState } from 'react';
import { Building2, CheckCircle2, MapPin, Pencil, Save, ShieldCheck, Users } from 'lucide-react';

/**
 * Company profile — logo (monogram stand-in), description and industry.
 * Edits are held in memory for the demo; when the employer account is wired to
 * the database this component keeps its shape and swaps its save handler.
 */
export default function CompanyProfilePanel({ profile, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);

  const save = (event) => {
    event.preventDefault();
    onChange({ ...draft, name: draft.name.trim() || profile.name });
    setEditing(false);
  };

  return (
    <section className="space-y-5">
      <div className="surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] border border-crimson/20 bg-crimson/10 font-heading text-xl font-bold text-crimson"
            aria-hidden="true"
          >
            {profile.monogram}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg font-semibold text-[#1d1d1f]">{profile.name}</h2>
              {profile.verified && (
                <span className="badge-pill inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  Verified partner
                </span>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                {profile.industry}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {profile.size}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {profile.location}
              </span>
            </p>
            <p className="text-sm leading-relaxed text-[#424245]">{profile.description}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {profile.hiringFor.map((role) => (
                <span key={role} className="badge-pill border border-black/10 bg-black/[0.03] text-[#424245]">
                  {role}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDraft(profile);
              setEditing((previous) => !previous);
            }}
            className="secondary-btn min-h-[44px] shrink-0 justify-center text-xs"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{editing ? 'Cancel' : 'Edit profile'}</span>
          </button>
        </div>
      </div>

      {editing && (
        <form onSubmit={save} className="surface space-y-4 p-5 sm:p-6">
          <h3 className="font-heading text-base font-semibold text-[#1d1d1f]">Edit company profile</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="company-name"
              label="Company name"
              value={draft.name}
              onChange={(value) => setDraft((previous) => ({ ...previous, name: value, monogram: monogramOf(value) }))}
            />
            <TextField
              id="company-industry"
              label="Industry"
              value={draft.industry}
              onChange={(value) => setDraft((previous) => ({ ...previous, industry: value }))}
            />
            <TextField
              id="company-size"
              label="Company size"
              value={draft.size}
              onChange={(value) => setDraft((previous) => ({ ...previous, size: value }))}
            />
            <TextField
              id="company-location"
              label="Location"
              value={draft.location}
              onChange={(value) => setDraft((previous) => ({ ...previous, location: value }))}
            />
          </div>
          <div>
            <label htmlFor="company-description" className="mb-1.5 block text-xs font-semibold text-muted">
              Description shown to students
            </label>
            <textarea
              id="company-description"
              rows={4}
              value={draft.description}
              onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))}
              className="w-full rounded-[16px] border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-[#1d1d1f] outline-none transition focus:border-crimson focus:ring-2 focus:ring-crimson/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="crimson-btn min-h-[44px] justify-center text-sm">
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>Save profile</span>
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="secondary-btn min-h-[44px] justify-center text-sm"
            >
              Cancel
            </button>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>Profile changes are held for this session only in the demo build.</span>
          </p>
        </form>
      )}
    </section>
  );
}

function monogramOf(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '??';
}

function TextField({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-[16px] border border-black/10 bg-black/[0.03] px-4 text-sm text-[#1d1d1f] outline-none transition focus:border-crimson focus:ring-2 focus:ring-crimson/20"
      />
    </div>
  );
}
