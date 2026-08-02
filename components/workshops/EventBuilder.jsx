'use client';

import { useMemo, useState } from 'react';
import { KeyRound, PlusCircle, Paperclip, ShieldCheck, ImagePlus, X } from 'lucide-react';
import { FACULTIES } from '@/lib/data/facultyData';
import {
  CATEGORY_LIST,
  DATE_FORMAT_HINT,
  checkInCodeFor,
  eventStatus,
  isValidEventDate,
} from './eventCatalogue';

/**
 * CPDC Event Builder (staff side).
 *
 * Creates an event, sets who it is scored against (faculty / programmes /
 * years), sets capacity, issues the venue check-in code, and attaches materials
 * to events that have already run.
 *
 * Role scoping: CPDC_ADMIN and SUPER_ADMIN publish for any faculty or
 * university-wide; FACULTY_COORDINATOR is locked to their own faculty.
 */

const INPUT = 'w-full min-h-[44px] rounded-[18px] border border-black/10 bg-black/[0.04] px-4 py-2.5 text-sm text-[#1d1d1f] placeholder:text-black/25 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson';
const LABEL = 'mb-1.5 block text-xs font-semibold text-muted';

export default function EventBuilder({ currentRole, activeFaculty, events = [], onCreate, onAddMaterial }) {
  const coordinatorLocked = currentRole === 'FACULTY_COORDINATOR';

  const [title, setTitle] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [speakerRole, setSpeakerRole] = useState('');
  const [speakerBio, setSpeakerBio] = useState('');
  const [category, setCategory] = useState('technical');
  const [facultyId, setFacultyId] = useState(coordinatorLocked ? activeFaculty?.id ?? '' : activeFaculty?.id ?? '');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('60');
  const [xpReward, setXpReward] = useState('150');
  const [years, setYears] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [tags, setTags] = useState('');
  const [summary, setSummary] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState([]);
  const [published, setPublished] = useState(null);

  // Read a chosen/dropped image into a data URL so the cover previews instantly
  // and travels with the event object. Real file storage is a backend concern;
  // this keeps the staff flow honest without a fake upload endpoint.
  const readCover = (file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setCoverImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const effectiveFacultyId = coordinatorLocked ? activeFaculty?.id ?? '' : facultyId;
  const facultyProgrammes = useMemo(
    () => FACULTIES.find((f) => f.id === effectiveFacultyId)?.programmes ?? [],
    [effectiveFacultyId],
  );

  const pastEvents = useMemo(
    () => events.filter((event) => eventStatus(event) === 'past'
      && (!coordinatorLocked || event.faculty === activeFaculty?.id)),
    [events, coordinatorLocked, activeFaculty?.id],
  );

  const toggle = (list, setList, value) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const submit = (e) => {
    e.preventDefault();
    const found = [];
    if (!title.trim()) found.push('Add an event title.');
    if (!speakerName.trim()) found.push('Add the speaker or facilitator name.');
    if (!date.trim() || !isValidEventDate(date)) {
      found.push(`Date must be in the format "${DATE_FORMAT_HINT}".`);
    }
    if (Number(capacity) <= 0) found.push('Capacity must be at least 1.');
    setErrors(found);
    if (found.length) return;

    const event = {
      id: `w-${Date.now()}`,
      title: title.trim(),
      faculty: effectiveFacultyId || null,
      category,
      speaker: {
        name: speakerName.trim(),
        role: speakerRole.trim() || 'Guest facilitator',
        bio: speakerBio.trim(),
      },
      date: date.trim(),
      location: location.trim() || 'To be confirmed',
      summary: summary.trim(),
      coverImage: coverImage || null,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      years: [...years].sort(),
      programmes,
      capacity: Number(capacity),
      seatsTaken: 0,
      xpReward: Number(xpReward) || 150,
      // Preview-only event objects never contain a usable check-in secret.
      // Published credentials are minted by the server and shown only to
      // authorised staff.
      qrCode: null,
      materials: [],
      registered: false,
    };

    onCreate?.(event);
    setPublished(event);
    setTitle(''); setSpeakerName(''); setSpeakerRole(''); setSpeakerBio('');
    setDate(''); setLocation(''); setSummary(''); setTags(''); setCoverImage('');
    setYears([]); setProgrammes([]);
  };

  return (
    <div className="space-y-6">
      <div className="surface flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h3 className="font-heading text-base font-semibold text-[#1d1d1f]">CPDC Event Builder</h3>
          <p className="mt-0.5 text-sm text-muted">
            Publish an event, choose who it is matched against, and issue its venue check-in code.
          </p>
        </div>
        <span className="badge-pill inline-flex items-center gap-1.5 border border-black/10 bg-black/[0.03] text-muted">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {coordinatorLocked ? `Scoped to ${activeFaculty?.name ?? 'your faculty'}` : 'Publishing for any faculty'}
        </span>
      </div>

      {published && (
        <div className="surface space-y-3 border-emerald-500/30 bg-emerald-50/40 p-5" role="status">
          <p className="text-sm font-semibold text-emerald-800">
            &ldquo;{published.title}&rdquo; is live in the student catalogue.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-[14px] border border-emerald-500/30 bg-white px-4 py-3">
              <KeyRound className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <span className="font-mono text-2xl font-bold tracking-[0.3em] text-[#1d1d1f]">
                {checkInCodeFor(published)}
              </span>
            </span>
            <p className="max-w-sm text-xs text-emerald-800">
              Display this code on the screen at the venue. Students type it to check in.
              A scannable QR code needs an encoder library, which is not installed —
              this code is the honest stand-in, not a fake QR image.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="surface space-y-5 p-6">
        {errors.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-[14px] border border-crimson/30 bg-crimson/[0.04] p-4 text-xs font-semibold text-crimson">
            {errors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        )}

        <div>
          <label className={LABEL} htmlFor="eb-title">Event title</label>
          <input id="eb-title" className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Portfolio Review Clinic for Final-Year Projects" />
        </div>

        <div>
          <span className={LABEL}>Cover image</span>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); readCover(e.dataTransfer.files?.[0]); }}
            className={`flex cursor-pointer items-center gap-4 rounded-[18px] border border-dashed p-4 transition ${
              dragging ? 'border-crimson bg-crimson/[0.05]' : 'border-black/20 hover:bg-black/[0.02]'
            }`}
          >
            <input type="file" accept="image/*" className="sr-only"
              onChange={(e) => readCover(e.target.files?.[0])} aria-label="Upload event cover image" />
            {coverImage ? (
              <span className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImage} alt="" className="h-16 w-28 rounded-[12px] border border-black/10 object-cover" />
              </span>
            ) : (
              <span className="flex h-16 w-28 shrink-0 items-center justify-center rounded-[12px] bg-black/[0.04] text-muted">
                <ImagePlus className="h-6 w-6" aria-hidden="true" />
              </span>
            )}
            <span className="text-xs text-muted">
              {coverImage
                ? 'Looks good — drop or choose another image to replace it. Cropped to the card ratio automatically.'
                : 'Drag & drop a cover image, or click to choose. Cropped to the card ratio automatically.'}
            </span>
          </label>
          {coverImage && (
            <button type="button" onClick={() => setCoverImage('')}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-crimson">
              <X className="h-3 w-3" aria-hidden="true" /> Remove image
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="eb-speaker">Speaker / facilitator</label>
            <input id="eb-speaker" className={INPUT} value={speakerName} onChange={(e) => setSpeakerName(e.target.value)}
              placeholder="e.g. Marina Yusof" />
          </div>
          <div>
            <label className={LABEL} htmlFor="eb-role">Their role</label>
            <input id="eb-role" className={INPUT} value={speakerRole} onChange={(e) => setSpeakerRole(e.target.value)}
              placeholder="e.g. CPDC Career Adviser" />
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="eb-bio">One-line speaker bio</label>
          <input id="eb-bio" className={INPUT} value={speakerBio} onChange={(e) => setSpeakerBio(e.target.value)}
            placeholder="One sentence students can actually judge relevance from" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="eb-date">Date &amp; time</label>
            <input id="eb-date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)}
              placeholder={DATE_FORMAT_HINT} />
            <p className="mt-1 text-[11px] text-muted">Format: {DATE_FORMAT_HINT}</p>
          </div>
          <div>
            <label className={LABEL} htmlFor="eb-location">Venue / stream</label>
            <input id="eb-location" className={INPUT} value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Auditorium 1 & virtual stream" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={LABEL} htmlFor="eb-category">Category</label>
            <select id="eb-category" className={INPUT} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_LIST.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="eb-capacity">Capacity</label>
            <input id="eb-capacity" type="number" min="1" className={INPUT} value={capacity}
              onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="eb-xp">XP awarded</label>
            <input id="eb-xp" type="number" min="0" step="10" className={INPUT} value={xpReward}
              onChange={(e) => setXpReward(e.target.value)} />
          </div>
        </div>

        <fieldset className="space-y-3 rounded-[18px] border border-black/[0.08] p-4">
          <legend className="px-1 text-xs font-semibold text-muted">Match targeting</legend>
          <p className="text-xs text-muted">
            Targeting changes ranking only. Every student still sees this event in the catalogue.
          </p>

          <div>
            <label className={LABEL} htmlFor="eb-faculty">Faculty</label>
            <select
              id="eb-faculty"
              className={INPUT}
              value={effectiveFacultyId}
              disabled={coordinatorLocked}
              onChange={(e) => { setFacultyId(e.target.value); setProgrammes([]); }}
            >
              <option value="">University-wide (no faculty targeting)</option>
              {FACULTIES.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
              ))}
            </select>
            {coordinatorLocked && (
              <p className="mt-1 text-[11px] text-muted">
                Faculty coordinators publish for their own faculty only.
              </p>
            )}
          </div>

          <div>
            <span className={LABEL}>Target years</span>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((year) => (
                <label
                  key={year}
                  className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-4 text-xs font-semibold transition ${
                    years.includes(year)
                      ? 'border-crimson bg-crimson/[0.06] text-crimson'
                      : 'border-black/10 text-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#e50914]"
                    checked={years.includes(year)}
                    onChange={() => toggle(years, setYears, year)}
                  />
                  Year {year}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted">Leave all unchecked for &ldquo;all years welcome&rdquo;.</p>
          </div>

          {facultyProgrammes.length > 0 && (
            <div>
              <span className={LABEL}>Target programmes</span>
              <div className="grid grid-cols-1 gap-1.5">
                {facultyProgrammes.map((programme) => (
                  <label key={programme.name} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-xs text-[#1d1d1f]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-[#e50914]"
                      checked={programmes.includes(programme.name)}
                      onChange={() => toggle(programmes, setProgrammes, programme.name)}
                    />
                    <span>{programme.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={LABEL} htmlFor="eb-tags">Interest tags (comma separated)</label>
            <input id="eb-tags" className={INPUT} value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. Communication, Career Planning" />
          </div>
        </fieldset>

        <div>
          <label className={LABEL} htmlFor="eb-summary">Summary shown on the card</label>
          <textarea id="eb-summary" rows={3} className={INPUT} value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What a student will actually walk out with." />
        </div>

        <button type="submit" className="crimson-btn min-h-[48px] w-full justify-center text-sm">
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          <span>Publish event</span>
        </button>
      </form>

      {/* Materials, uploaded after the event has run */}
      <div className="surface space-y-4 p-6">
        <div>
          <h3 className="font-heading text-base font-semibold text-[#1d1d1f]">Post-event materials</h3>
          <p className="mt-0.5 text-sm text-muted">
            Attach slides, worksheets or recordings to an event that has already run. File storage is
            not wired up yet, so this records the material&apos;s title and type for the archive.
          </p>
        </div>

        {pastEvents.length === 0 ? (
          <p className="text-sm text-muted">No past events in your scope yet.</p>
        ) : (
          <ul className="space-y-3">
            {pastEvents.map((event) => (
              <MaterialRow key={event.id} event={event} onAddMaterial={onAddMaterial} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MaterialRow({ event, onAddMaterial }) {
  const [value, setValue] = useState('');
  const [type, setType] = useState('Slides');

  return (
    <li className="rounded-[18px] border border-black/[0.08] p-4">
      <p className="text-sm font-semibold text-[#1d1d1f]">{event.title}</p>
      <p className="mt-0.5 text-xs text-muted">
        {(event.materials ?? []).length} material{(event.materials ?? []).length === 1 ? '' : 's'} attached
      </p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          onAddMaterial?.(event.id, { title: value.trim(), type });
          setValue('');
        }}
      >
        <input
          className={INPUT}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`Material title for ${event.title}`}
          placeholder="e.g. Session slides (PDF)"
        />
        <select
          className={`${INPUT} sm:w-40`}
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label={`Material type for ${event.title}`}
        >
          {['Recap', 'Photos', 'Slides', 'Worksheet', 'Guide', 'Recording', 'Code'].map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <button type="submit" className="secondary-btn min-h-[44px] shrink-0 text-xs">
          <Paperclip className="h-4 w-4" aria-hidden="true" />
          <span>Attach</span>
        </button>
      </form>
    </li>
  );
}
