'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap,
  UploadCloud,
  PencilLine,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Sparkles,
} from 'lucide-react';
import PosterUpload from './fyp/PosterUpload';
import GuidedForm, { GUIDED_FIELDS } from './fyp/GuidedForm';
import DualSyncPreview from './fyp/DualSyncPreview';
import { XP_VALUES } from '@/lib/xp';
import { fetchFypProject, saveFypProject } from '@/lib/api';
import { emitXpUpdated } from '@/lib/xp-events';

const FYP_STATUS_META = {
  DRAFT: { label: 'Draft saved', className: 'bg-slate-50 text-slate-700 border-slate-200' },
  PENDING_REVIEW: { label: 'Pending review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  NEEDS_CHANGES: { label: 'Needs changes', className: 'bg-crimson/10 text-crimson border-crimson/25' },
};

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

const REQUIRED_GUIDED_FIELD_IDS = GUIDED_FIELDS.filter((f) => f.required).map((f) => f.id);

// Poster path still needs a couple of pieces of metadata to be useful on a
// CV / showcase card, on top of the file itself.
const POSTER_META_FIELDS = [
  { id: 'title', label: 'Project Title', placeholder: 'e.g. Real-Time Flood Prediction Using Edge AI' },
  { id: 'supervisor', label: 'Supervisor Name', placeholder: 'e.g. Dr. Aisha Rahman' },
];

export default function FYPShowcase({ student, setStudent, activeFaculty }) {
  const [mode, setMode] = useState(null); // null | 'poster' | 'guided'
  const [formData, setFormData] = useState({});
  const [posterFile, setPosterFile] = useState(null); // { file, name, size, type, previewUrl }
  const [publicOptIn, setPublicOptIn] = useState(false); // default OFF — never opt students in silently
  const [submitted, setSubmitted] = useState(false);

  // The saved project from the database. Because it's persisted server-side, a
  // submitted FYP survives a cleared browser and shows the Head of Programme's
  // review decision when they've acted on it.
  const [existing, setExisting] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchFypProject()
      .then((data) => {
        if (!cancelled && data?.project) setExisting(data.project);
      })
      .catch(() => {
        // No saved project (or not signed in) — the fresh submission flow shows.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Revoke the object URL whenever the file changes or the component unmounts,
  // so we never leak blob memory across selections.
  useEffect(() => {
    return () => {
      if (posterFile?.previewUrl) {
        URL.revokeObjectURL(posterFile.previewUrl);
      }
    };
  }, [posterFile]);

  const handleFieldChange = (fieldId, value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handlePosterSelected = (file) => {
    // Replace any existing preview first so we don't leak the old blob URL.
    setPosterFile((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      const isImage = file.type.startsWith('image/');
      return {
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
      };
    });
  };

  const handleRemovePoster = () => {
    setPosterFile((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const handleReset = () => {
    if ((Object.keys(formData).length > 0 || posterFile) && !window.confirm('Discard this project draft and start over?')) {
      return;
    }
    setMode(null);
    setFormData({});
    handleRemovePoster();
    setPublicOptIn(false);
    setSubmitted(false);
  };

  // Progress indicator — counts required sections for whichever path is active.
  const { completed, total } = useMemo(() => {
    if (mode === 'guided') {
      const done = REQUIRED_GUIDED_FIELD_IDS.filter((id) => (formData[id] || '').trim().length > 0).length;
      return { completed: done, total: REQUIRED_GUIDED_FIELD_IDS.length };
    }
    if (mode === 'poster') {
      const metaDone = POSTER_META_FIELDS.filter((f) => (formData[f.id] || '').trim().length > 0).length;
      const fileDone = posterFile ? 1 : 0;
      return { completed: metaDone + fileDone, total: POSTER_META_FIELDS.length + 1 };
    }
    return { completed: 0, total: 1 };
  }, [mode, formData, posterFile]);

  const isComplete = total > 0 && completed === total;
  const hasDraftContent = Object.values(formData).some((value) => String(value ?? '').trim().length > 0) || Boolean(posterFile);

  const handleSubmit = async (submitStatus = 'PENDING_REVIEW') => {
    const isDraft = submitStatus === 'DRAFT';
    if ((!isDraft && !isComplete) || submitted || saving) return;
    if (isDraft && !hasDraftContent) {
      setSaveError('Add at least one project detail before saving a draft.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const posterData = mode === 'poster' ? await readFileAsDataUrl(posterFile?.file) : null;
      const payload = {
        title: formData.title || formData.projectTitle || 'Final Year Project',
        abstract: formData.abstract || formData.summary || formData.methodology || '—',
        supervisorName: formData.supervisor || '',
        repositoryUrl: formData.repositoryUrl || formData.repoUrl || '',
        liveUrl: formData.liveUrl || formData.demoUrl || '',
        posterData,
        posterName: posterFile?.name ?? null,
        publicOptIn,
        status: submitStatus,
      };
      const { project, xp } = await saveFypProject(payload);
      setExisting(project);
      setSubmitted(!isDraft);
      emitXpUpdated(xp); // headline XP refreshes from the ledger
      // Keep the local projection roughly in sync for other screens this session.
      setStudent((prev) => ({
        ...prev,
        publicTalent: publicOptIn,
        fypSubmission: {
          status: project.status,
          title: project.title,
          publicOptIn: project.publicOptIn,
          submittedAt: project.updatedAt,
        },
      }));
      if (isDraft) {
        setMode(null);
        setFormData({});
        handleRemovePoster();
        setSaveError('');
      }
    } catch (error) {
      setSaveError(error.message || 'Could not save your project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b border-black/10 pb-6">
        <div>
          <h1 className="section-title flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-crimson" />
            <span>Final Year Project Showcase</span>
          </h1>
          <p className="section-subtitle mt-1.5 max-w-lg">
            Turn your capstone project into a career asset — synced to your Auto-CV, and optionally shown on the QIU
            Talent Showcase.
          </p>
        </div>

        {mode && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/[0.03] border border-black/10 text-xs text-muted font-semibold whitespace-nowrap">
              {isComplete ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Circle className="w-4 h-4 text-crimson" />
              )}
              <span>{completed} of {total} sections complete</span>
            </div>
            <button type="button" onClick={handleReset} className="secondary-btn text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Start Over</span>
            </button>
          </div>
        )}
      </div>

      {/* Saved submission status — proves the project persisted server-side and
          shows the Head of Programme's decision once they've reviewed it. */}
      {existing && !mode && (
        <div className="surface p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`badge-pill border ${
                    (FYP_STATUS_META[existing.status] ?? FYP_STATUS_META.PENDING_REVIEW).className
                  }`}
                >
                  {(FYP_STATUS_META[existing.status] ?? FYP_STATUS_META.PENDING_REVIEW).label}
                </span>
                {existing.publicOptIn && (
                  <span className="badge-pill bg-black/[0.04] text-muted border border-black/10">
                    Talent feed: opted in
                  </span>
                )}
              </div>
              <h2 className="font-heading font-bold text-lg text-[#1d1d1f] mt-2 leading-snug">
                {existing.title}
              </h2>
              <p className="text-sm text-muted mt-1 line-clamp-2">{existing.abstract}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode('guided');
                setFormData({
                  title: existing.title,
                  abstract: existing.abstract,
                  repositoryUrl: existing.repositoryUrl ?? '',
                  liveUrl: existing.liveUrl ?? '',
                });
                setPublicOptIn(Boolean(existing.publicOptIn));
                setSubmitted(false);
              }}
              className="secondary-btn text-xs shrink-0"
            >
              <PencilLine className="w-3.5 h-3.5" /> Edit &amp; resubmit
            </button>
          </div>
          {existing.status === 'NEEDS_CHANGES' && existing.reviewNote && (
            <div className="rounded-[14px] border border-crimson/25 bg-crimson/[0.04] p-3.5 text-xs text-[#1d1d1f]">
              <p className="font-semibold text-crimson mb-0.5">
                Feedback from {existing.reviewerName ?? 'your reviewer'}:
              </p>
              <p className="text-muted">{existing.reviewNote}</p>
            </div>
          )}
          {existing.status === 'APPROVED' && (
            <p className="text-xs text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Approved
              {existing.reviewerName ? ` by ${existing.reviewerName}` : ''} — eligible for the public talent feed.
            </p>
          )}
        </div>
      )}

      {saveError && (
        <div className="rounded-[14px] border border-crimson/25 bg-crimson/[0.05] px-4 py-3 text-sm font-semibold text-crimson" role="alert">
          {saveError}
        </div>
      )}

      {/* Step 1: choose a submission path (progressive disclosure) */}
      {!mode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <button
            type="button"
            onClick={() => setMode('poster')}
            className="surface surface-interactive p-7 text-left space-y-3 min-h-[44px]"
          >
            <div className="w-11 h-11 rounded-xl bg-crimson/10 border border-crimson/30 flex items-center justify-center">
              <UploadCloud className="w-5 h-5 text-crimson" />
            </div>
            <h2 className="font-heading font-semibold text-base text-[#1d1d1f]">Upload a Digital Poster</h2>
            <p className="text-xs text-muted leading-relaxed">
              Already have a project poster? Drag and drop an image or PDF and we will attach it to your profile.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode('guided')}
            className="surface surface-interactive p-7 text-left space-y-3 min-h-[44px]"
          >
            <div className="w-11 h-11 rounded-xl bg-crimson/10 border border-crimson/30 flex items-center justify-center">
              <PencilLine className="w-5 h-5 text-crimson" />
            </div>
            <h2 className="font-heading font-semibold text-base text-[#1d1d1f]">Guided Text Entry</h2>
            <p className="text-xs text-muted leading-relaxed">
              No poster yet? Answer a short set of guided questions about your title, abstract, methodology and results.
            </p>
          </button>
        </div>
      )}

      {/* Step 2: the chosen path, plus the dual-sync preview once something is entered */}
      {mode && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="surface p-7 space-y-6">
              <div className="border-b border-black/10 pb-4">
                <h3 className="font-heading font-semibold text-base text-[#1d1d1f]">
                  {mode === 'poster' ? 'Digital Poster Upload' : 'Guided Project Details'}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {mode === 'poster'
                    ? 'Upload your poster, then add a couple of details so it can be indexed.'
                    : 'Fields marked with * are required to complete your showcase entry.'}
                </p>
              </div>

              {mode === 'poster' ? (
                <div className="space-y-6">
                  <PosterUpload
                    posterFile={posterFile}
                    onFileSelected={handlePosterSelected}
                    onRemove={handleRemovePoster}
                  />
                  <div className="space-y-5">
                    {POSTER_META_FIELDS.map((field) => (
                      <div key={field.id}>
                        <label htmlFor={`fyp-poster-${field.id}`} className="block text-xs font-semibold text-muted mb-1.5">
                          {field.label} <span className="text-crimson">*</span>
                        </label>
                        <input
                          id={`fyp-poster-${field.id}`}
                          type="text"
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <GuidedForm formData={formData} onFieldChange={handleFieldChange} />
              )}

              {isComplete && (
                <div className="space-y-3 rounded-[18px] border border-emerald-500/30 bg-emerald-50/40 p-4 text-xs font-semibold text-emerald-700" role="status" aria-live="polite">
                  <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>{submitted ? `Submission complete — +${XP_VALUES.FYP_SUBMISSION} XP awarded and synced to your Auto-CV.` : 'Everything is ready. Review the preview, then submit to sync this project to your Auto-CV.'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitted || saving}
                    className="crimson-btn min-h-[44px] w-full justify-center text-xs disabled:cursor-default disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{saving ? 'Saving…' : submitted ? 'Submitted & synced' : 'Submit project & sync to CV'}</span>
                  </button>
                </div>
              )}
              {!submitted && hasDraftContent && (
                <button
                  type="button"
                  onClick={() => handleSubmit('DRAFT')}
                  disabled={saving}
                  className="secondary-btn min-h-[44px] w-full justify-center text-xs disabled:opacity-60"
                >
                  <span>{saving ? 'Saving…' : 'Save draft and continue later'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <DualSyncPreview
              student={student}
              activeFaculty={activeFaculty}
              title={formData.title}
              summary={formData.abstract}
              techStack={formData.techStack}
              supervisor={formData.supervisor}
              posterPreviewUrl={posterFile?.previewUrl}
              isPdf={posterFile?.type === 'application/pdf'}
              publicOptIn={publicOptIn}
              onTogglePublicOptIn={() => setPublicOptIn((v) => !v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
