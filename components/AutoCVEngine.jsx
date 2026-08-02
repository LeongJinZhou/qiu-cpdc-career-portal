import React, { useEffect, useRef, useState } from 'react';
import { 
  FileText, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  Award, 
  Briefcase, 
  GraduationCap, 
  Mail, 
  Phone, 
  Globe,
  RefreshCw,
  History,
  ScanSearch,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { fetchCvData } from '@/lib/api';

export default function AutoCVEngine({ student, activeFaculty }) {
  const cvRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  // Live CV data pulled from the database (approved hours, badges, FYP, skills)
  // — replaces the fixture arrays so the CV reflects what the student actually
  // earned. Falls back to the session projection until it loads.
  const [live, setLive] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchCvData()
      .then((data) => { if (!cancelled) setLive(data); })
      .catch(() => { /* keep projection fallback */ });
    return () => { cancelled = true; };
  }, []);

  const allLogbookEntries = live?.logbookEntries
    ?? (Array.isArray(student?.logbookEntries) ? student.logbookEntries : []);
  const logbookEntries = live?.verifiedLogbookEntries
    ?? allLogbookEntries.filter((entry) => entry?.verified || entry?.status === 'APPROVED');
  const pendingLogbookEntries = live?.pendingLogbookEntries
    ?? allLogbookEntries.filter((entry) => !entry?.verified && entry?.status !== 'APPROVED');
  const badges = live?.badges ?? (Array.isArray(student?.badges) ? student.badges : []);
  const skills = (live?.skills?.length ? live.skills : (Array.isArray(student?.skills) ? student.skills : []));
  const loggedHours = live?.hours ?? logbookEntries.reduce((total, entry) => total + Number(entry?.hours || 0), 0);
  const certifications = live?.certifications ?? [];
  const manualSections = live?.manualSections ?? { experience: [], volunteering: [], achievements: [] };
  const manualEntries = Object.entries(manualSections).flatMap(([section, entries]) => (
    (entries ?? []).map((entry) => ({ ...entry, section }))
  ));
  const liveSourceLabel = student?.liveIdentity ? 'Live verified identity' : 'Demo preview data';
  const logbookSourceLabel = student?.liveLogbookLoaded
    ? 'Live protected API'
    : student?.liveLogbookError
      ? 'Live sync failed'
      : 'Local projection';

  const defaultSummary = `Year ${student?.year ?? 1} student in ${student?.programme ?? 'your programme'} at Quest International University, building practical experience through coursework, projects and supervised fieldwork.`;
  const [summaryText, setSummaryText] = useState(defaultSummary);
  const [template, setTemplate] = useState('classic');
  const [aiReview, setAiReview] = useState(null);
  const [savedVersions, setSavedVersions] = useState([]);

  useEffect(() => {
    const storedSummary = live?.profile?.resumeSummary?.trim();
    setSummaryText(storedSummary || defaultSummary);
  }, [defaultSummary, live?.profile?.resumeSummary]);

  useEffect(() => {
    try {
      const storageKey = `qiu.cv.versions.${student?.matricNo ?? student?.id ?? 'anonymous'}`;
      const stored = JSON.parse(window.localStorage?.getItem(storageKey) ?? '[]');
      if (Array.isArray(stored)) setSavedVersions(stored.slice(0, 5));
    } catch {
      // Version history is optional in restricted browsers.
    }
  }, [student?.id, student?.matricNo]);

  // Real, selectable-text PDF built with jsPDF's text API — not an html2canvas
  // screenshot. The old image-based export produced a PDF with no extractable
  // text, so ATS parsers reported "no text detected". This lays every field out
  // as actual text so recruiters' systems can read it.
  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 16;
      const contentW = pageW - margin * 2;
      let y = margin;

      const ensureSpace = (needed) => {
        if (y + needed > pageH - margin) { pdf.addPage(); y = margin; }
      };
      const heading = (text) => {
        ensureSpace(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(0xe5, 0x09, 0x14);
        pdf.text(text.toUpperCase(), margin, y);
        y += 2;
        pdf.setDrawColor(0xe0, 0xe0, 0xe0);
        pdf.line(margin, y, pageW - margin, y);
        y += 5;
        pdf.setTextColor(0x1d, 0x1d, 0x1f);
      };
      const body = (text, { size = 10, bold = false, gap = 5 } = {}) => {
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(size);
        const lines = pdf.splitTextToSize(text, contentW);
        ensureSpace(lines.length * (size * 0.42) + 1);
        pdf.text(lines, margin, y);
        y += lines.length * (size * 0.42) + gap;
      };

      // Header — name + contact line
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(0x1d, 0x1d, 0x1f);
      pdf.text(student?.name ?? 'QIU Student', margin, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(0x6e, 0x6e, 0x73);
      const contact = [
        student?.email,
        `${student?.programme ?? ''}${activeFaculty?.name ? ` · ${activeFaculty.name}` : ''}`,
        student?.matricNo || student?.id,
      ].filter(Boolean).join('  |  ');
      pdf.text(pdf.splitTextToSize(contact, contentW), margin, y);
      y += 8;
      pdf.setTextColor(0x1d, 0x1d, 0x1f);

      // Professional summary
      heading('Professional Summary');
      body(summaryText || defaultSummary);

      // Skills
      if (skills.length) {
        heading('Skills');
        body(skills.join(' · '));
      }

      // Verified fieldwork
      if (logbookEntries.length) {
        heading(`Verified Fieldwork (${loggedHours} hrs)`);
        logbookEntries.forEach((log) => {
          const dateStr = log.date ? new Date(log.date).toISOString().slice(0, 10) : '';
          const verified = log.verified ?? (log.status === 'APPROVED');
          body(
            `${log.title || 'Fieldwork entry'} — ${Number(log.hours || 0)} hrs${dateStr ? ` (${dateStr})` : ''}${verified ? ' — verified' : ''}${log.supervisor ? `, supervised by ${log.supervisor}` : ''}`,
            { size: 9.5, gap: 3 },
          );
        });
        y += 2;
      }

      // Student-authored experience
      if (manualEntries.length) {
        heading('Experience & Activities Added by Student');
        manualEntries.forEach((entry) => {
          const period = entry.startDate || entry.endDate
            ? ` (${entry.startDate || ''}${entry.startDate || entry.endDate ? ' – ' : ''}${entry.endDate || 'Present'})`
            : '';
          body(`${entry.title}${entry.organisation ? ` — ${entry.organisation}` : ''}${period}`, { bold: true, size: 9.5, gap: 2 });
          if (entry.description) body(entry.description, { size: 9.5, gap: 3 });
        });
      }

      // Credentials / badges
      if (badges.length) {
        heading(`Credentials & Badges (${badges.length})`);
        badges.forEach((b) => body(`• ${b.title}${b.category ? ` — ${b.category}` : ''}`, { size: 9.5, gap: 2.5 }));
        y += 2;
      }

      if (certifications.length) {
        heading('Verified Online Courses & Certificates');
        certifications.forEach((certification) => {
          body(`${certification.title}${certification.provider ? ` — ${certification.provider}` : ''}`, { size: 9.5, gap: 2.5 });
        });
        y += 2;
      }

      // FYP
      if (live?.fyp) {
        heading('Final Year Project');
        body(`${live.fyp.title}${live.fyp.status ? ` (${live.fyp.status.replace('_', ' ').toLowerCase()})` : ''}`, { bold: true, gap: 2 });
        if (live.fyp.abstract) body(live.fyp.abstract, { size: 9.5 });
      }

      const fileStem = (student?.name ?? 'QIU_Student').replace(/\s+/g, '_');
      pdf.save(`${fileStem}_QIU_ATS_CV.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert("We couldn't generate the PDF. Please try again or use your browser's print option.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleEnhanceSummary = () => {
    setSummaryText(
      ` ${student?.programme ?? 'QIU'} student with ${loggedHours} approved fieldwork hours and experience in ${skills.slice(0, 3).join(', ') || 'practical learning'}. Seeking an opportunity to contribute, learn and grow.`.trim(),
    );
  };

  const handleRecheck = () => {
    const words = summaryText.trim().split(/\s+/).filter(Boolean);
    const checks = [
      { label: 'Specific role or programme is named', passed: summaryText.includes(student?.programme ?? '') || /engineer|analyst|research|designer|manager/i.test(summaryText) },
      { label: 'Uses measurable evidence', passed: /\d+|percent|reduced|increased|built|led|delivered/i.test(summaryText) },
      { label: 'Concise ATS length', passed: words.length >= 24 && words.length <= 90 },
    ];
    const passed = checks.filter((check) => check.passed).length;
    setAiReview({ score: Math.round((passed / checks.length) * 100), checks });
  };

  const applySuggestion = () => {
    setSummaryText(`${student?.programme ?? 'QIU'} student building practical solutions with ${skills.slice(0, 3).join(', ') || 'technical and communication skills'}. Completed ${loggedHours} approved fieldwork hours and seeking roles where evidence-led problem solving creates measurable impact.`);
    setAiReview(null);
  };

  const saveVersion = () => {
    const version = { id: Date.now(), savedAt: new Date().toISOString(), summary: summaryText, template };
    const next = [version, ...savedVersions].slice(0, 5);
    setSavedVersions(next);
    try {
      const storageKey = `qiu.cv.versions.${student?.matricNo ?? student?.id ?? 'anonymous'}`;
      window.localStorage?.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Keep the version available for this session.
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-black/10 pb-6">
        <div>
          <h2 className="section-title flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-crimson" />
            <span>Auto-CV Generator & ATS Resume Engine</span>
          </h2>
          <p className="section-subtitle mt-1.5 max-w-lg">
            Combines your QIU-approved activity with the experience and summary you enter. Nothing is labelled verified unless QIU has approved it.
          </p>
        </div>

        <div className="flex flex-wrap items-stretch gap-3 sm:items-center">
          <button
            type="button"
            onClick={handleEnhanceSummary}
            className="secondary-btn min-h-[44px] flex-1 justify-center text-xs sm:flex-none"
          >
            <Sparkles className="w-4 h-4" />
            <span>Improve summary wording</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="crimson-btn min-h-[44px] flex-1 justify-center text-xs sm:flex-none"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isExporting ? 'Exporting PDF...' : 'Download ATS PDF Resume'}</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Controls & Live Resume Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side (5 Cols): Data Sources & Controls */}
        <div className="lg:col-span-5 space-y-5">
          
          <div className="surface p-6 space-y-4">
            <h3 className="font-heading font-semibold text-sm text-[#1d1d1f] flex items-center gap-2 border-b border-black/10 pb-3">
              <Sparkles className="w-4 h-4 text-crimson" />
              <span>Auto-Synced Data Sources</span>
            </h3>

            {/* Source Item 1 */}
            <div className="p-4 rounded-[18px] bg-black/[0.03] border border-black/[0.06] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#424245]">
                <span className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-muted" />
                  Academic Profile
                </span>
                <span className="text-emerald-600 text-[10px] flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> {liveSourceLabel}
                </span>
              </div>
              <p className="text-xs text-muted">{student?.programme ?? 'Programme not linked yet'} • Year {student?.year ?? '—'}</p>
            </div>

            {/* Source Item 2 */}
            <div className="p-4 rounded-[18px] bg-black/[0.03] border border-black/[0.06] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#424245]">
                <span className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-muted" />
                  Verified Badges ({badges.length})
                </span>
                <span className="text-emerald-600 text-[10px] flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Auto-Formatted
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {badges.map(b => (
                  <span key={b.id} className="text-[10px] px-2.5 py-1 rounded-full bg-black/[0.03] text-muted font-medium">
                    {b.title}
                  </span>
                ))}
              </div>
            </div>

            {/* Source Item 3 */}
            <div className="p-4 rounded-[18px] bg-black/[0.03] border border-black/[0.06] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#424245]">
                <span className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted" />
                  Logged Fieldwork Hours ({loggedHours} hrs)
                </span>
                <span className="text-emerald-600 text-[10px] flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> {logbookSourceLabel}
                </span>
              </div>
              <p className="text-xs text-muted">
                {logbookEntries.length > 0
                  ? `${logbookEntries.length} approved entr${logbookEntries.length === 1 ? 'y is' : 'ies are'} ready for export.`
                  : 'No approved fieldwork entries are ready for export yet.'}
              </p>
              {pendingLogbookEntries.length > 0 ? (
                <p className="text-xs text-amber-700">
                  {pendingLogbookEntries.length} pending entr{pendingLogbookEntries.length === 1 ? 'y is' : 'ies are'} not included until a supervisor approves {pendingLogbookEntries.length === 1 ? 'it' : 'them'}.
                </p>
              ) : null}
            </div>
          </div>

          {/* Editable Executive Summary */}
          <div className="surface p-6 space-y-3">
            <div className="flex items-center justify-between gap-3"><label htmlFor="executive-summary" className="block text-xs font-semibold text-[#424245]">Professional summary</label><button type="button" onClick={handleRecheck} className="secondary-btn px-3 py-2 text-[11px]"><ScanSearch className="h-3.5 w-3.5" /> Check wording</button></div>
            <textarea
              id="executive-summary"
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              rows={4}
              className="w-full p-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#424245] placeholder:text-black/20 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition leading-relaxed"
            />
            {aiReview && <div className="rounded-[16px] border border-black/10 bg-black/[0.025] p-4" role="status"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wide text-muted">Inline resume review</span><span className={`font-heading text-xl font-bold ${aiReview.score >= 67 ? 'text-emerald-600' : 'text-amber-600'}`}>{aiReview.score}/100</span></div><div className="mt-3 space-y-2">{aiReview.checks.map((check) => <p key={check.label} className={`flex items-center gap-2 text-xs ${check.passed ? 'text-emerald-700' : 'text-amber-700'}`}>{check.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}{check.label}</p>)}</div>{aiReview.score < 100 && <button type="button" onClick={applySuggestion} className="mt-3 text-xs font-semibold text-crimson hover:underline">Apply suggested rewrite</button>}</div>}
          </div>

          <div className="surface space-y-4 p-6">
            <div className="flex items-center gap-2 border-b border-black/10 pb-3"><FileText className="h-4 w-4 text-crimson" /><h3 className="font-heading text-sm font-semibold">Resume controls</h3></div>
            <div><p className="mb-2 text-xs font-semibold text-muted">Template</p><div className="flex gap-2"><button type="button" onClick={() => setTemplate('classic')} className={`secondary-btn flex-1 justify-center text-xs ${template === 'classic' ? 'border-crimson text-crimson' : ''}`}>Classic ATS</button><button type="button" onClick={() => setTemplate('impact')} className={`secondary-btn flex-1 justify-center text-xs ${template === 'impact' ? 'border-crimson text-crimson' : ''}`}>Impact</button></div></div>
            <button type="button" onClick={saveVersion} className="secondary-btn w-full justify-center text-xs"><History className="h-3.5 w-3.5" /> Save version</button>
            {savedVersions.length > 0 && <div className="space-y-2"><p className="text-xs font-semibold text-muted">Saved versions</p>{savedVersions.slice(0, 3).map((version) => <button type="button" key={version.id} onClick={() => { setSummaryText(version.summary); setTemplate(version.template || 'classic'); }} className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-black/10 px-3 py-2 text-left text-xs hover:border-crimson/30"><span>{new Date(version.savedAt).toLocaleDateString()}</span><span className="text-muted">{version.template || 'classic'}</span></button>)}</div>}
          </div>

        </div>

        {/* Right Side (7 Cols): Printable Clean White ATS Document */}
        <div className="lg:col-span-7">
          <div className="bg-black/[0.04] p-6 rounded-[18px] border border-black/10 shadow-lg flex justify-center overflow-x-auto">

            {/* The ATS Printable Page — paper surface, deliberately distinct from the dark chrome */}
            <div
              ref={cvRef}
              className={`w-[210mm] min-h-[297mm] bg-white text-slate-900 p-10 font-sans shadow-[0_20px_60px_rgba(0,0,0,0.5)] space-y-6 text-left selection:bg-slate-200 ${template === 'impact' ? 'border-l-[10px] border-crimson' : ''}`}
              style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
            >
              
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 space-y-1">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{student?.name ?? 'QIU Student'}</h1>
                <p className="text-xs font-bold text-red-600 uppercase tracking-wider">
                  {student?.programme ?? 'Programme pending'} | Quest International University ({activeFaculty?.code ?? 'QIU'})
                </p>
                <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-600 pt-1">
                  {student?.email ? <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-500" /> {student.email}</span> : null}
                  {live?.profile?.phone || student?.phone ? <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-500" /> {live?.profile?.phone || student.phone}</span> : null}
                  {live?.profile?.portfolioUrl ? <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-slate-500" /> {live.profile.portfolioUrl}</span> : null}
                  {live?.profile?.linkedinUrl ? <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-slate-500" /> {live.profile.linkedinUrl}</span> : null}
                </div>
              </div>

              {/* Executive Summary */}
              <div className="space-y-1">
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1">
                  PROFESSIONAL SUMMARY
                </h2>
                <p className="text-[11px] leading-relaxed text-slate-700 pt-1">
                  {summaryText}
                </p>
              </div>

              {/* Education */}
              <div className="space-y-2">
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1">
                  EDUCATION
                </h2>
                <div className="flex justify-between items-start text-xs">
                  <div>
                    <span className="font-bold text-slate-900">QUEST INTERNATIONAL UNIVERSITY</span>
                    <p className="text-[11px] text-slate-700">{student?.programme ?? 'Programme pending'} ({activeFaculty?.name ?? 'QIU'})</p>
                  </div>
                  <div className="text-right text-[11px]">
                    <p className="text-slate-600">Current Year: Year {student?.year ?? '—'}</p>
                  </div>
                </div>
              </div>

              {/* Verified Fieldwork & Logbook Experience */}
              <div className="space-y-2">
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1">
                  QIU-APPROVED FIELDWORK & INTERNSHIP LOGS
                </h2>

                {logbookEntries.map((log) => (
                  <div key={log.id} className="text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">{log.title}</span>
                      <span className="text-[10px] font-semibold text-slate-600">{log.date} ({log.hours} Shift Hours)</span>
                    </div>
                    <p className="text-[10px] text-slate-600 italic">Supervisor: {log.supervisor || 'Not recorded'} • Status: Approved</p>
                    <ul className="list-disc list-inside text-[11px] text-slate-700 pl-1">
                      <li>{log.details}</li>
                    </ul>
                  </div>
                ))}
              </div>

              {/* Verified Badges & Technical Competencies */}
              <div className="space-y-2">
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1">
                  VERIFIED UNIVERSITY BADGES & CREDENTIALS
                </h2>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {badges.map(b => (
                    <div key={b.id} className="p-1.5 bg-slate-100 rounded border border-slate-200">
                      <span className="font-bold text-slate-900 block">{b.title}</span>
                      <span className="text-[9px] text-slate-600">{b.category} • Issued {b.date} (+{b.xp} XP)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Student-authored experience */}
              {manualEntries.length ? <div className="space-y-2">
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1">
                  EXPERIENCE &amp; ACTIVITIES ADDED BY STUDENT
                </h2>
                {manualEntries.map((entry) => (
                  <div key={`${entry.section}-${entry.id}`} className="text-[11px] text-slate-700">
                    <p className="font-bold text-slate-900">{entry.title}{entry.organisation ? ` · ${entry.organisation}` : ''}</p>
                    <p className="text-[10px] text-slate-600">{entry.startDate || entry.endDate ? `${entry.startDate || ''}${entry.startDate || entry.endDate ? ' – ' : ''}${entry.endDate || 'Present'}` : ''}</p>
                    {entry.description ? <p>{entry.description}</p> : null}
                  </div>
                ))}
              </div> : null}

              {/* Industry Certifications */}
              {certifications.length ? <div className="space-y-2">
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1">
                  ONLINE CERTIFICATIONS & HACKATHONS
                </h2>
                <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1">
                  {certifications.map((certification) => (
                    <li key={certification.id}><strong>{certification.title}</strong>{certification.provider ? ` · ${certification.provider}` : ''}{certification.verifiedAt ? ` (verified ${new Date(certification.verifiedAt).toLocaleDateString()})` : ''}</li>
                  ))}
                </ul>
              </div> : null}

              {/* Footer Verification Stamp */}
              <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
                <span>Generated from QIU Career Hub records{student?.matricNo ? ` • Student ID: ${student.matricNo}` : ''}</span>
                <span className="font-mono">Approved records are marked above</span>
              </div>

            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
