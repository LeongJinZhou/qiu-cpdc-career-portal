'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileUp, LoaderCircle, LockKeyhole, Play, RefreshCcw, Send, ShieldCheck } from 'lucide-react';
import { fetchAssessments, fetchFaculties, importAssessment, startAssessmentAttempt, submitAssessmentAttempt, updateAssessment } from '@/lib/api';

const AUTHOR_ROLES = new Set(['HEAD_OF_PROGRAMME', 'FACULTY_COORDINATOR', 'ACADEMIC_SUPERVISOR', 'CPDC_ADMIN', 'SUPER_ADMIN']);

export default function AssessmentWorkspace({ currentRole, activeFaculty, student }) {
  const isAuthor = AUTHOR_ROLES.has(currentRole);
  return isAuthor
    ? <StaffAssessmentWorkspace currentRole={currentRole} activeFaculty={activeFaculty} student={student} />
    : <StudentAssessmentWorkspace activeFaculty={activeFaculty} student={student} />;
}

function StaffAssessmentWorkspace({ currentRole, activeFaculty, student }) {
  const [assessments, setAssessments] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('Choose one answer for each question.');
  const [passMark, setPassMark] = useState('60');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('');
  const [targetFacultyId, setTargetFacultyId] = useState(activeFaculty?.id ?? '');
  const [targetProgrammeId, setTargetProgrammeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAssessments(currentRole);
      setAssessments(data.assessments ?? []);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'We could not load assessments.');
    } finally {
      setLoading(false);
    }
  }, [currentRole]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetchFaculties()
      .then((data) => setFaculties(data.faculties ?? []))
      .catch(() => setFaculties(activeFaculty ? [activeFaculty] : []));
  }, [activeFaculty]);

  const selectedFaculty = faculties.find((faculty) => faculty.id === targetFacultyId) ?? activeFaculty;
  const programmeOptions = selectedFaculty?.programmes ?? [];

  const upload = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Choose a PDF, Word document, or text file first.');
      return;
    }
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('instructions', instructions);
      formData.append('passMark', String(Number(passMark || 60) / 100));
      if (timeLimitMinutes) formData.append('timeLimitMinutes', timeLimitMinutes);
      if (targetFacultyId) formData.append('facultyId', targetFacultyId);
      if (targetProgrammeId) formData.append('programmeId', targetProgrammeId);
      const data = await importAssessment(formData, currentRole);
      setAssessments((previous) => [data.assessment, ...previous]);
      setFile(null);
      setTitle('');
      setMessage(`Draft created with ${data.assessment.questions?.length ?? 0} questions. Review it before publishing.`);
      const input = document.getElementById('assessment-source-file');
      if (input) input.value = '';
    } catch (uploadError) {
      const details = uploadError?.details?.length ? ` ${uploadError.details.join(' ')}` : '';
      setError(`${uploadError.message || 'The document could not be imported.'}${details}`);
    } finally {
      setUploading(false);
    }
  };

  const publish = async (assessment) => {
    setBusyId(assessment.id);
    setError('');
    try {
      const data = await updateAssessment(assessment.id, { status: 'PUBLISHED' }, currentRole);
      setAssessments((previous) => previous.map((item) => item.id === assessment.id ? data.assessment : item));
      setMessage(`${assessment.title} is now published for matching students.`);
    } catch (publishError) {
      setError(publishError.message || 'This assessment is not ready to publish.');
    } finally {
      setBusyId('');
    }
  };

  const archive = async (assessment) => {
    setBusyId(assessment.id);
    try {
      const data = await updateAssessment(assessment.id, { status: 'ARCHIVED' }, currentRole);
      setAssessments((previous) => previous.map((item) => item.id === assessment.id ? data.assessment : item));
      setMessage(`${assessment.title} is archived. Students can no longer start it.`);
    } catch (archiveError) {
      setError(archiveError.message || 'We could not archive this assessment.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-7 animate-fadeIn">
      <header className="space-y-2 border-b border-black/10 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">Staff assessment workspace</p>
        <h1 className="section-title flex items-center gap-2.5"><ClipboardCheck className="h-6 w-6 text-crimson" /> Create assessments for students</h1>
        <p className="section-subtitle max-w-3xl">Upload a prepared PDF, Word file, or text file. The system reads the questions into a draft. You check the answer keys, then publish it to the correct faculty or programme.</p>
        <p className="text-xs text-muted">Current scope: {activeFaculty?.name ?? 'your assigned QIU scope'}. A published assessment is locked; import a new file when you need a revised version.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={upload} className="surface space-y-5 p-6">
          <div className="flex items-start gap-3"><FileUp className="mt-0.5 h-5 w-5 text-crimson" /><div><h2 className="font-heading text-lg font-semibold">1. Upload the question paper</h2><p className="mt-1 text-xs leading-relaxed text-muted">Supported files: PDF, .doc, .docx, and UTF-8 .txt. Maximum size: 8 MB.</p></div></div>
          <label htmlFor="assessment-source-file" className="block rounded-[18px] border-2 border-dashed border-black/15 bg-black/[0.02] p-5 text-sm hover:border-crimson/40"><span className="block font-semibold">Choose source file</span><span className="mt-1 block text-xs text-muted">The original file is not stored in the database; only the source name and normalized questions are kept.</span><input id="assessment-source-file" type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-4 block w-full text-xs" /></label>
          <label className="block"><span className="field-label">Assessment title (optional)</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Taken from the document if left blank" className="text-input" /></label>
          <label className="block"><span className="field-label">Instructions for students</span><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} className="text-input h-auto py-3" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="field-label">Pass mark (%)</span><input type="number" min="1" max="100" value={passMark} onChange={(event) => setPassMark(event.target.value)} className="text-input" /></label><label className="block"><span className="field-label">Time limit (minutes)</span><input type="number" min="1" max="600" value={timeLimitMinutes} onChange={(event) => setTimeLimitMinutes(event.target.value)} placeholder="Optional" className="text-input" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="field-label">Target faculty</span><select value={targetFacultyId} onChange={(event) => { setTargetFacultyId(event.target.value); setTargetProgrammeId(''); }} className="text-input"><option value="">All faculties</option>{faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select></label><label className="block"><span className="field-label">Target programme (optional)</span><select value={targetProgrammeId} onChange={(event) => setTargetProgrammeId(event.target.value)} disabled={!targetFacultyId || !programmeOptions.length} className="text-input disabled:opacity-50"><option value="">Whole selected faculty</option>{programmeOptions.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}</select></label></div>
          <p className="text-xs text-muted">Students see this only when their faculty and programme match. Your role scope still controls what you are allowed to publish.</p>
          <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900"><strong>Use this format:</strong> number each question, put options on separate lines as A., B., C., D., and include an explicit <code>Answer: B</code> line. The system will not guess answers. Image-only scanned PDFs need OCR first; this importer reads selectable text.</div>
          {error && <p className="text-sm font-semibold text-crimson" role="alert">{error}</p>}
          {message && <p className="text-sm font-semibold text-emerald-700" role="status">{message}</p>}
          <button type="submit" disabled={uploading} className="crimson-btn min-h-[48px] w-full justify-center disabled:opacity-60">{uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{uploading ? 'Reading document…' : 'Create draft from file'}</button>
        </form>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-heading text-lg font-semibold">2. Review and publish</h2><p className="mt-1 text-xs text-muted">Check every question and answer before students see it.</p></div><button type="button" onClick={load} className="secondary-btn px-3 py-2 text-xs"><RefreshCcw className="h-3.5 w-3.5" /> Refresh</button></div>
          {loading ? <div className="surface p-8 text-center text-sm text-muted"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /><p className="mt-2">Loading assessment drafts…</p></div> : assessments.length === 0 ? <div className="surface p-8 text-center"><ClipboardCheck className="mx-auto h-8 w-8 text-muted" /><p className="mt-3 font-semibold">No assessments yet</p><p className="mt-1 text-sm text-muted">Upload your first question paper. It will stay a draft until you publish it.</p></div> : <div className="space-y-3">{assessments.map((assessment) => <StaffAssessmentCard key={assessment.id} assessment={assessment} currentRole={currentRole} busy={busyId === assessment.id} onPublish={() => publish(assessment)} onArchive={() => archive(assessment)} />)}</div>}
        </section>
      </div>
    </div>
  );
}

function StaffAssessmentCard({ assessment, currentRole, busy, onPublish, onArchive }) {
  const [keys, setKeys] = useState({});
  const [savingKeys, setSavingKeys] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const questions = useMemo(() => assessment.questions ?? [], [assessment.questions]);

  useEffect(() => {
    setKeys(Object.fromEntries(questions.map((question) => [
      question.id,
      question.correctOptionIndexes?.[0] ?? null,
    ])));
  }, [assessment.id, assessment.updatedAt, questions]);

  const answerFor = (question) => keys[question.id] ?? null;
  const ready = questions.length > 0 && questions.every((question) => Number.isInteger(answerFor(question)) && answerFor(question) < question.options.length);
  const hasAnyKey = questions.some((question) => Number.isInteger(answerFor(question)));

  const saveKeys = async () => {
    setSavingKeys(true);
    setKeyError('');
    setKeySaved(false);
    try {
      await updateAssessment(assessment.id, {
        questionEdits: questions
          .filter((question) => Number.isInteger(answerFor(question)))
          .map((question) => ({ id: question.id, correctOptionIndex: answerFor(question) })),
      }, currentRole);
      setKeySaved(true);
    } catch (error) {
      setKeyError(error.message || 'The answer keys could not be saved.');
    } finally {
      setSavingKeys(false);
    }
  };

  return (
    <article className="surface space-y-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge-pill border ${assessment.status === 'PUBLISHED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : assessment.status === 'ARCHIVED' ? 'border-black/10 bg-black/[0.04] text-muted' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{assessmentStatusLabel(assessment.status)}</span>
            <span className="text-xs text-muted">{assessment.sourceFileName ?? 'Imported source'}</span>
          </div>
          <h3 className="mt-2 font-heading text-lg font-semibold">{assessment.title}</h3>
          <p className="mt-1 text-xs text-muted">{questions.length} questions · pass mark {Math.round(assessment.passMark * 100)}%{assessment.timeLimitMinutes ? ` · ${assessment.timeLimitMinutes} minutes` : ''}</p>
        </div>
        <ShieldCheck className="h-5 w-5 shrink-0 text-crimson" aria-hidden="true" />
      </div>
      <div className="rounded-[14px] border border-black/10 bg-black/[0.02] p-3 text-xs text-muted">
        <p className="font-semibold text-[#1d1d1f]">Review checklist</p>
        <p className="mt-1">{ready ? 'Every question has an answer key.' : 'Choose an answer key for every question before publishing.'} {assessment.faculty?.code ?? 'All faculties'}{assessment.programme ? ` · ${assessment.programme.name}` : ''}</p>
      </div>
      <details open={assessment.status === 'DRAFT'} className="rounded-[14px] border border-black/10">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Review all {questions.length} questions and answer keys</summary>
        <ol className="space-y-4 border-t border-black/10 p-4">
          {questions.map((question) => (
            <li key={question.id ?? question.order} className="space-y-2 text-sm">
              <p><span className="font-semibold text-crimson">{question.order}.</span> {question.prompt}</p>
              <ul className="space-y-1 text-xs text-muted">{question.options.map((option, index) => <li key={`${question.id}-${index}`} className={answerFor(question) === index ? 'font-semibold text-emerald-700' : ''}>{optionLabel(index)}. {option}{answerFor(question) === index ? ' · answer key' : ''}</li>)}</ul>
              {question.explanation ? <p className="text-xs italic text-muted">Explanation: {question.explanation}</p> : null}
              <label className="block text-xs font-semibold text-[#1d1d1f]">Correct answer<select value={answerFor(question) ?? ''} disabled={assessment.status !== 'DRAFT' || savingKeys} onChange={(event) => { setKeySaved(false); setKeys((previous) => ({ ...previous, [question.id]: event.target.value === '' ? null : Number(event.target.value) })); }} className="text-input mt-1 h-10 py-1"><option value="">Choose an answer</option>{question.options.map((option, index) => <option key={`${question.id}-key-${index}`} value={index}>{optionLabel(index)} · {option}</option>)}</select></label>
            </li>
          ))}
        </ol>
      </details>
      {assessment.attempts?.length ? (
        <details className="rounded-[14px] border border-black/10">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Student results ({assessment.attempts.filter((attempt) => attempt.submittedAt).length} submitted)</summary>
          <div className="space-y-2 border-t border-black/10 p-4 text-xs">{assessment.attempts.map((attempt) => <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-black/[0.02] px-3 py-2"><span>{attempt.student?.name ?? attempt.student?.matricNo ?? 'Student'}{attempt.student?.name && attempt.student?.matricNo ? ` · ${attempt.student.matricNo}` : ''}</span><span className={attempt.submittedAt ? 'font-semibold text-emerald-700' : 'text-muted'}>{attempt.submittedAt ? `${Math.round((attempt.score ?? 0) * 100)}% · ${attempt.passed ? 'Passed' : 'Not passed'}` : 'In progress'}</span></div>)}</div>
        </details>
      ) : null}
      {assessment.status === 'DRAFT' && <>
        <button type="button" onClick={saveKeys} disabled={busy || savingKeys || !hasAnyKey} className="secondary-btn min-h-[44px] w-full justify-center disabled:opacity-50">{savingKeys ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Save answer keys</button>
        {keyError ? <p className="text-sm font-semibold text-crimson" role="alert">{keyError}</p> : null}
        {keySaved ? <p className="text-sm font-semibold text-emerald-700" role="status">Answer keys saved. Read the questions once more before publishing.</p> : null}
      </>}
      {assessment.status === 'DRAFT' && <button type="button" onClick={onPublish} disabled={busy || savingKeys || !ready} className="crimson-btn min-h-[44px] w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busy ? 'Publishing…' : ready ? 'Publish for students' : 'Choose every answer key first'}</button>}
      {assessment.status === 'PUBLISHED' && <button type="button" onClick={onArchive} disabled={busy} className="secondary-btn min-h-[44px] w-full justify-center disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}Archive assessment</button>}
    </article>
  );
}

function optionLabel(index) {
  return String.fromCharCode(65 + index);
}

function assessmentStatusLabel(status) {
  return { DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' }[status] ?? status;
}

function StudentAssessmentWorkspace({ activeFaculty, student }) {
  const [assessments, setAssessments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState({});
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAssessments('STUDENT');
      setAssessments(data.assessments ?? []);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'We could not load published assessments.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const start = async (assessment) => {
    setStartingId(assessment.id);
    setError('');
    try {
      const data = await startAssessmentAttempt(assessment.id);
      setSelected(assessment);
      setAnswers({});
      setAttempt(data.attempt);
      setTimeLeft(data.attempt.expiresAt ? Math.max(0, Math.ceil((new Date(data.attempt.expiresAt).getTime() - Date.now()) / 1000)) : null);
    } catch (startError) {
      setError(startError.message || 'We could not start this assessment.');
    } finally {
      setStartingId('');
    }
  };

  const submit = useCallback(async (event, { timedOut = false } = {}) => {
    event?.preventDefault();
    if (!selected || !attempt?.id || submitting) return;
    const answered = Object.keys(answers).length;
    if (!timedOut && answered !== selected.questions.length) {
      setError('Please answer every question before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = await submitAssessmentAttempt(selected.id, answers, attempt.id);
      setAttempt(data.attempt);
      setTimeLeft(null);
      setAssessments((previous) => previous.map((item) => item.id === selected.id ? { ...item, attempts: [data.attempt, ...(item.attempts ?? [])] } : item));
    } catch (submitError) {
      setError(submitError.message || 'We could not submit this assessment.');
    } finally {
      setSubmitting(false);
    }
  }, [answers, attempt?.id, selected, submitting]);

  useEffect(() => {
    if (!selected || !attempt?.expiresAt || attempt.score !== null && attempt.score !== undefined || submitting) return undefined;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(seconds);
      if (seconds <= 0) {
        window.clearInterval(timer);
        submit(null, { timedOut: true });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, selected, submit, submitting]);

  const leave = () => {
    setSelected(null);
    setAttempt(null);
    setAnswers({});
    setTimeLeft(null);
    setError('');
  };

  return <div className="space-y-7 animate-fadeIn">
    <header className="space-y-2 border-b border-black/10 pb-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">Student assessment workspace</p><h1 className="section-title flex items-center gap-2.5"><ClipboardCheck className="h-6 w-6 text-crimson" /> Assessments & tests</h1><p className="section-subtitle max-w-3xl">Published tests for {student?.programme ?? activeFaculty?.name ?? 'your programme'}. Start a test when you are ready; the server records the attempt and enforces any time limit.</p></header>
    {selected ? <AssessmentAttempt assessment={selected} answers={answers} setAnswers={setAnswers} attempt={attempt} timeLeft={timeLeft} submitting={submitting} error={error} onSubmit={submit} onBack={leave} /> : <>
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-heading text-lg font-semibold">Published for you</h2><p className="mt-1 text-xs text-muted">Only assessments matching your faculty or programme appear here.</p></div><button type="button" onClick={load} className="secondary-btn px-3 py-2 text-xs"><RefreshCcw className="h-3.5 w-3.5" /> Refresh</button></div>
      {error && <p className="text-sm font-semibold text-crimson" role="alert">{error}</p>}
      {loading ? <div className="surface p-8 text-center text-sm text-muted"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /><p className="mt-2">Loading published assessments…</p></div> : assessments.length === 0 ? <div className="surface p-8 text-center"><ClipboardCheck className="mx-auto h-8 w-8 text-muted" /><p className="mt-3 font-semibold">No test has been published for you yet</p><p className="mt-1 text-sm text-muted">Your lecturer or CPDC officer will publish the assessment when it is ready.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{assessments.map((assessment) => <article key={assessment.id} className="surface space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div><span className="badge-pill border border-emerald-200 bg-emerald-50 text-emerald-700">Published</span><h3 className="mt-3 font-heading text-lg font-semibold">{assessment.title}</h3></div><CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /></div><p className="text-sm leading-relaxed text-muted">{assessment.instructions || 'Answer every question and submit when you are ready.'}</p><p className="text-xs text-muted">{assessment.questions?.length ?? 0} questions · pass mark {Math.round(assessment.passMark * 100)}%{assessment.timeLimitMinutes ? ` · ${assessment.timeLimitMinutes} minutes` : ''}</p>{assessment.attempts?.filter((item) => item.submittedAt).length ? <p className="text-xs font-semibold text-muted">Previous attempts: {assessment.attempts.filter((item) => item.submittedAt).map((item) => `${Math.round((item.score ?? 0) * 100)}%${item.passed ? ' passed' : ''}`).join(' · ')}</p> : null}<button type="button" onClick={() => start(assessment)} disabled={startingId === assessment.id} className="crimson-btn min-h-[44px] w-full justify-center disabled:opacity-60">{startingId === assessment.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{startingId === assessment.id ? 'Starting…' : 'Start assessment'}</button></article>)}</div>}
    </>}
  </div>;
}

function AssessmentAttempt({ assessment, answers, setAnswers, attempt, timeLeft, submitting, error, onSubmit, onBack }) {
  const answered = useMemo(() => Object.keys(answers).length, [answers]);
  const submitted = attempt && attempt.score !== null && attempt.score !== undefined;
  if (submitted) return <section className="mx-auto max-w-2xl space-y-5"><div className="surface space-y-4 p-7 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Assessment submitted</p><h2 className="font-heading text-2xl font-semibold">{Math.round(attempt.score * 100)}% — {attempt.passed ? 'Passed' : 'Not passed yet'}</h2><p className="text-sm text-muted">Your attempt has been saved. Staff can see the result in the role-permitted student record.{attempt.timedOut ? ' The time limit had ended, so unanswered questions were counted as incorrect.' : ''}</p><button type="button" onClick={onBack} className="secondary-btn mx-auto">Back to assessments</button></div></section>;
  return <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-5"><div className="surface space-y-2 p-6"><button type="button" onClick={onBack} className="text-xs font-semibold text-crimson hover:underline">← Back to assessments</button><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="mt-3 font-heading text-2xl font-semibold">{assessment.title}</h2>{timeLeft !== null ? <span className={`badge-pill border ${timeLeft <= 60 ? 'border-crimson/30 bg-crimson/10 text-crimson' : 'border-black/10 bg-black/[0.03] text-muted'}`} role="timer">Time left: {formatTimeLeft(timeLeft)}</span> : null}</div><p className="text-sm text-muted">{assessment.instructions}</p><p className="text-xs font-semibold text-muted">Answered {answered} of {assessment.questions.length}. Your attempt is held by the server until you submit.</p></div>{assessment.questions.map((question) => <fieldset key={question.id} className="surface space-y-4 p-5"><legend className="max-w-full font-heading text-base font-semibold text-[#1d1d1f]"><span className="mr-2 text-crimson">{question.order}.</span>{question.prompt}</legend><div className="space-y-2">{question.options.map((option, index) => <label key={`${question.id}-${index}`} className={`flex cursor-pointer items-start gap-3 rounded-[14px] border p-3.5 text-sm transition ${Number(answers[question.id]) === index ? 'border-crimson bg-crimson/[0.04]' : 'border-black/10 hover:border-crimson/30'}`}><input type="radio" name={`question-${question.id}`} checked={Number(answers[question.id]) === index} onChange={() => setAnswers((previous) => ({ ...previous, [question.id]: index }))} className="mt-0.5 accent-[var(--crimson)]" /> <span>{option}</span></label>)}</div></fieldset>)}{error && <p className="text-sm font-semibold text-crimson" role="alert">{error}</p>}<button type="submit" disabled={submitting || timeLeft === 0 || answered !== assessment.questions.length} className="crimson-btn min-h-[48px] w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{submitting ? 'Submitting…' : timeLeft === 0 ? 'Time expired — submitting…' : answered === assessment.questions.length ? 'Submit assessment' : 'Answer every question first'}</button></form>;
}

function formatTimeLeft(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
