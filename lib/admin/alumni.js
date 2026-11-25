// Alumni tracking for CPDC: who graduated (or is ready to), whether their
// LinkedIn is linked by sign-in (so they can still sign in after the QIU
// email closes), their personal email and when CPDC last saw them.

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

/** One table row. Only fields CPDC needs; no tokens, no raw provider data. */
export function toAlumniRow(student) {
  const user = student?.user ?? {};
  const linkedin = (student?.connectedAccounts ?? []).find((account) => account.provider === 'LINKEDIN') ?? null;
  return {
    name: user.name ?? '',
    matricNo: student?.matricNo ?? '',
    programme: student?.programme?.name ?? '',
    faculty: student?.faculty?.name ?? '',
    status: user.role === 'ALUMNI' ? 'Alumni' : 'Ready to graduate',
    qiuEmail: user.email ?? '',
    personalEmail: user.personalEmail ?? null,
    linkedinLinked: Boolean(linkedin && linkedin.method === 'OAUTH' && linkedin.providerUserId),
    linkedinUrl: linkedin?.profileUrl || null,
    linkedinLastSeenAt: iso(user.linkedinLastSeenAt),
    lastSignInAt: iso(user.lastSignInAt),
  };
}

export function summarizeAlumni(rows, now = new Date()) {
  return {
    total: rows.length,
    alumni: rows.filter((row) => row.status === 'Alumni').length,
    linkedinLinked: rows.filter((row) => row.linkedinLinked).length,
    seenLast12Months: rows.filter((row) => (
      row.linkedinLastSeenAt && now - new Date(row.linkedinLastSeenAt) < YEAR_MS
    )).length,
  };
}

const CSV_COLUMNS = [
  ['Name', 'name'],
  ['Matric no', 'matricNo'],
  ['Programme', 'programme'],
  ['Faculty', 'faculty'],
  ['Status', 'status'],
  ['QIU email', 'qiuEmail'],
  ['Personal email', 'personalEmail'],
  ['Signs in with LinkedIn', 'linkedinLinked'], // gitleaks:allow (field name, not a client id)
  ['LinkedIn profile', 'linkedinUrl'],
  ['Last seen on LinkedIn', 'linkedinLastSeenAt'],
  ['Last sign-in', 'lastSignInAt'],
];

/** Quote every cell; prefix a cell that a spreadsheet would run as a formula. */
function csvCell(value) {
  let text = value == null ? '' : String(value === true ? 'Yes' : value === false ? 'No' : value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function alumniCsv(rows) {
  const lines = [CSV_COLUMNS.map(([label]) => csvCell(label)).join(',')];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map(([, key]) => csvCell(row[key])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

const ALUMNI_WHERE = { OR: [{ user: { role: 'ALUMNI' } }, { alumniEligibleAt: { not: null } }] };

/**
 * Alumni and students the system marked alumni-eligible, newest first.
 * Returns { rows, totalInDatabase } so the screen can say when the list was cut.
 */
export async function listAlumni(prismaClient, { limit = 2000 } = {}) {
  const totalInDatabase = await prismaClient.student.count({ where: ALUMNI_WHERE });
  const students = await prismaClient.student.findMany({
    where: ALUMNI_WHERE,
    select: {
      matricNo: true,
      alumniEligibleAt: true,
      lifecycleStatus: true,
      programme: { select: { name: true } },
      faculty: { select: { name: true } },
      user: {
        select: {
          name: true, email: true, role: true, personalEmail: true, linkedinLastSeenAt: true, lastSignInAt: true,
        },
      },
      connectedAccounts: {
        where: { provider: 'LINKEDIN' },
        select: { provider: true, method: true, providerUserId: true, profileUrl: true },
      },
    },
    orderBy: [{ alumniEligibleAt: 'desc' }, { matricNo: 'asc' }],
    take: limit,
  });
  return { rows: students.map(toAlumniRow), totalInDatabase };
}
