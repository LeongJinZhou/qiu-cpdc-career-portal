'use client';

import { forwardRef } from 'react';

/**
 * The printable page.
 *
 * Every colour here is an inline hex value on purpose. Tailwind v4 emits
 * `oklch()` colours, which html2canvas 1.4.1 cannot parse — a single Tailwind
 * colour utility inside this subtree makes the PDF export throw. Layout
 * utilities are fine; colour utilities are not.
 */

const INK = '#0f172a';
const BODY = '#334155';
const MUTED = '#64748b';
const RULE = '#cbd5e1';
const CRIMSON = '#e50914';

const TEMPLATE_STYLE = {
  classic: { lead: 1.55, gap: 20, headerRule: `2px solid ${INK}`, spine: null, headingColor: INK },
  impact: { lead: 1.55, gap: 22, headerRule: `3px solid ${CRIMSON}`, spine: CRIMSON, headingColor: CRIMSON },
  compact: { lead: 1.35, gap: 13, headerRule: `1px solid ${INK}`, spine: null, headingColor: INK },
};

function SectionHeading({ children, style }) {
  return (
    <h2
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: style.headingColor,
        borderBottom: `1px solid ${RULE}`,
        paddingBottom: 3,
        marginBottom: 6,
      }}
    >
      {children}
    </h2>
  );
}

function groupOf(entries, group) {
  return entries.filter((entry) => entry.group === group);
}

const ResumeDocument = forwardRef(function ResumeDocument(
  { resume, summary, manualEntries, template = 'classic' },
  ref,
) {
  const style = TEMPLATE_STYLE[template] ?? TEMPLATE_STYLE.classic;
  const { header, education, entries, totals, skills } = resume;
  const compact = template === 'compact';

  const fieldwork = groupOf(entries, 'fieldwork');
  const projects = groupOf(entries, 'projects');
  const learning = groupOf(entries, 'learning');
  const credentials = groupOf(entries, 'credentials');

  const manualBySection = (sectionId) =>
    manualEntries.filter((entry) => entry.section === sectionId && (entry.title || entry.bullets?.some(Boolean)));

  return (
    <div
      ref={ref}
      style={{
        width: '210mm',
        minHeight: '297mm',
        backgroundColor: '#ffffff',
        color: INK,
        padding: compact ? '14mm' : '16mm',
        fontFamily: 'Inter, Helvetica, Arial, sans-serif',
        fontSize: 11,
        lineHeight: style.lead,
        textAlign: 'left',
        borderLeft: style.spine ? `10px solid ${style.spine}` : 'none',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: style.headerRule, paddingBottom: 10, marginBottom: style.gap }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: INK, margin: 0 }}>
          {header.name}
        </h1>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: CRIMSON, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 0' }}>
          {header.programme} | Quest International University ({header.facultyCode})
        </p>
        <p style={{ fontSize: 9.5, color: MUTED, margin: '6px 0 0' }}>
          {[header.email, ...header.links].filter(Boolean).join('  •  ')}
        </p>
        <p style={{ fontSize: 9, color: MUTED, margin: '3px 0 0' }}>
          QIU Career XP: {header.xp.toLocaleString()} • {header.tier.name} tier •{' '}
          {totals.verifiedCount} university-verified entries
        </p>
      </div>

      {/* Summary */}
      {summary?.trim() && (
        <div style={{ marginBottom: style.gap }}>
          <SectionHeading style={style}>Professional summary</SectionHeading>
          <p style={{ fontSize: 10.5, color: BODY, margin: 0 }}>{summary}</p>
        </div>
      )}

      {/* Education */}
      <div style={{ marginBottom: style.gap }}>
        <SectionHeading style={style}>Education</SectionHeading>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 11 }}>{education.institution}</span>
            <p style={{ fontSize: 10.5, color: BODY, margin: '2px 0 0' }}>
              {education.programme} — {education.faculty}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, color: MUTED, whiteSpace: 'nowrap' }}>
            Year {education.year}
          </div>
        </div>
      </div>

      {/* Verified fieldwork */}
      {fieldwork.length > 0 && (
        <div style={{ marginBottom: style.gap }}>
          <SectionHeading style={style}>Verified fieldwork &amp; internship logs</SectionHeading>
          {fieldwork.map((entry) => (
            <div key={entry.id} style={{ marginBottom: compact ? 6 : 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 10.5 }}>{entry.title}</span>
                {entry.state === 'awaiting-approval' && (
                  <span style={{ fontSize: 8.5, color: MUTED, whiteSpace: 'nowrap' }}>awaiting sign-off</span>
                )}
              </div>
              <p style={{ fontSize: 9, color: MUTED, margin: '1px 0 0' }}>{entry.meta}</p>
              {entry.detail && (
                <p style={{ fontSize: 10, color: BODY, margin: '3px 0 0' }}>{entry.detail}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <div style={{ marginBottom: style.gap }}>
          <SectionHeading style={style}>Capstone &amp; final year project</SectionHeading>
          {projects.map((entry) => (
            <div key={entry.id} style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 10.5 }}>{entry.title}</span>
              <p style={{ fontSize: 9, color: MUTED, margin: '1px 0 0' }}>{entry.meta}</p>
            </div>
          ))}
        </div>
      )}

      {/* Manual sections */}
      {[
        { id: 'experience', label: 'Work experience' },
        { id: 'volunteering', label: 'Volunteering' },
        { id: 'achievements', label: 'Achievements' },
      ].map(({ id, label }) => {
        const items = manualBySection(id);
        if (!items.length) return null;
        return (
          <div key={id} style={{ marginBottom: style.gap }}>
            <SectionHeading style={style}>{label}</SectionHeading>
            {items.map((item) => (
              <div key={item.id} style={{ marginBottom: compact ? 6 : 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 10.5 }}>
                    {item.title}
                    {item.organisation ? ` — ${item.organisation}` : ''}
                  </span>
                  {item.period && (
                    <span style={{ fontSize: 9, color: MUTED, whiteSpace: 'nowrap' }}>{item.period}</span>
                  )}
                </div>
                <ul style={{ margin: '3px 0 0', paddingLeft: 16 }}>
                  {(item.bullets ?? []).filter(Boolean).map((bullet, index) => (
                    <li key={index} style={{ fontSize: 10, color: BODY }}>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      })}

      {/* Learning */}
      {learning.length > 0 && (
        <div style={{ marginBottom: style.gap }}>
          <SectionHeading style={style}>Workshops, courses &amp; assessments</SectionHeading>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {learning.map((entry) => (
              <li key={entry.id} style={{ fontSize: 10, color: BODY }}>
                <span style={{ fontWeight: 600, color: INK }}>{entry.title}</span>
                {entry.meta ? ` — ${entry.meta}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Credentials */}
      {credentials.length > 0 && (
        <div style={{ marginBottom: style.gap }}>
          <SectionHeading style={style}>Verified QIU badges</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? 4 : 6 }}>
            {credentials.map((entry) => (
              <div
                key={entry.id}
                style={{ border: `1px solid ${RULE}`, borderRadius: 4, padding: '4px 6px' }}
              >
                <span style={{ display: 'block', fontWeight: 700, fontSize: 10 }}>{entry.title}</span>
                <span style={{ fontSize: 8.5, color: MUTED }}>{entry.meta}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div style={{ marginBottom: style.gap }}>
          <SectionHeading style={style}>Skills</SectionHeading>
          <p style={{ fontSize: 10, color: BODY, margin: 0 }}>{skills.join(' • ')}</p>
        </div>
      )}

      <div
        style={{
          borderTop: `1px solid ${RULE}`,
          paddingTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 8.5,
          color: MUTED,
        }}
      >
        <span>Verified entries confirmed by QIU Career Hub</span>
        <span>{totals.loggedHours} logged hours • {totals.badgeCount} badges</span>
      </div>
    </div>
  );
});

export default ResumeDocument;
