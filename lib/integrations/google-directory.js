// Google Workspace directory enrichment (Module 16).
//
// The Firebase ID token only proves email + name. The Employee ID
// (e.g. "QIU-202310-006958"), the course code (e.g. "BCS") and the employee
// type ("Student") live in the QIU Google Workspace *directory*, visible on a
// user's Google Contacts card. We read them at login via the People API using
// the signed-in student's own OAuth access token (per-user directory.readonly
// scope), then store them on the Student row.
//
// `mapPeopleProfile` is a PURE function over a People API `person` resource so
// the field mapping is unit-testable without any network. The exact People API
// field that carries "Employee ID" / "Employee Type" depends on how QIU's
// Workspace is configured, so the mapper is deliberately tolerant and keeps the
// raw payload; the route logs it once on first real login so the mapping can be
// confirmed and tightened against live data.

const PEOPLE_API_URL = 'https://people.googleapis.com/v1/people/me';
export const DIRECTORY_SCOPE = 'https://www.googleapis.com/auth/directory.readonly';
const PERSON_FIELDS = 'emailAddresses,organizations,externalIds,names';
const DEFAULT_TIMEOUT_MS = 8000;

// QIU Employee ID / matric shape, e.g. QIU-202310-006958.
const EMPLOYEE_ID_PATTERN = /\bQIU-\d{6}-\d{6}\b/i;

function firstString(...values) {
  for (const value of values) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) return text;
  }
  return null;
}

/** Prefer the primary or @qiu.edu.my email; fall back to the first present. */
function pickEmail(emailAddresses = []) {
  const list = Array.isArray(emailAddresses) ? emailAddresses : [];
  const primary = list.find((entry) => entry?.metadata?.primary && entry.value);
  const qiu = list.find((entry) => typeof entry?.value === 'string' && entry.value.toLowerCase().endsWith('@qiu.edu.my'));
  return firstString(primary?.value, qiu?.value, list[0]?.value);
}

/**
 * Employee ID. Prefer any externalId (or org field) whose value matches the QIU
 * pattern; then one whose (formatted)type names "employee"; then the first
 * external id; then an organization cost-centre carrying the pattern.
 */
function pickEmployeeId(externalIds = [], organizations = []) {
  const ids = Array.isArray(externalIds) ? externalIds : [];
  const patterned = ids.find((entry) => EMPLOYEE_ID_PATTERN.test(String(entry?.value ?? '')));
  if (patterned) return String(patterned.value).match(EMPLOYEE_ID_PATTERN)[0];

  const byType = ids.find((entry) => /employee/i.test(`${entry?.type ?? ''} ${entry?.formattedType ?? ''}`) && entry?.value);
  if (byType) return String(byType.value).trim();

  const orgs = Array.isArray(organizations) ? organizations : [];
  const orgPatterned = orgs.map((o) => o?.costCenter).find((v) => EMPLOYEE_ID_PATTERN.test(String(v ?? '')));
  if (orgPatterned) return String(orgPatterned).match(EMPLOYEE_ID_PATTERN)[0];

  return firstString(ids[0]?.value);
}

/** Course code such as "BCS": prefer org department, then costCenter, then a
 *  BCS-like token in the title. */
function pickCourseCode(organizations = []) {
  const orgs = Array.isArray(organizations) ? organizations : [];
  const primary = orgs.find((o) => o?.metadata?.primary) ?? orgs[0] ?? {};
  const fromDept = firstString(primary.department);
  if (fromDept) return fromDept;
  const fromCost = firstString(primary.costCenter);
  if (fromCost && !EMPLOYEE_ID_PATTERN.test(fromCost)) return fromCost;
  // "QIU Student • BCS" style titles: take a trailing short upper-case token.
  const title = firstString(primary.title, primary.name);
  const token = title?.match(/\b([A-Z]{2,6})\b\s*$/);
  return token ? token[1] : null;
}

/** Employee type such as "Student". Native People API has no dedicated field,
 *  so read organization type/title heuristically. */
function pickEmployeeType(organizations = []) {
  const orgs = Array.isArray(organizations) ? organizations : [];
  const primary = orgs.find((o) => o?.metadata?.primary) ?? orgs[0] ?? {};
  const title = `${primary.title ?? ''} ${primary.name ?? ''}`;
  if (/student/i.test(title)) return 'Student';
  if (/staff|lecturer|academic/i.test(title)) return 'Staff';
  return firstString(primary.costCenter && !EMPLOYEE_ID_PATTERN.test(primary.costCenter) ? primary.costCenter : null);
}

/**
 * Map a People API `person` resource to the directory fields we persist.
 * Pure and defensive: unknown shapes yield nulls rather than throwing.
 */
export function mapPeopleProfile(person = {}) {
  const p = person && typeof person === 'object' ? person : {};
  return {
    email: pickEmail(p.emailAddresses),
    employeeId: pickEmployeeId(p.externalIds, p.organizations),
    courseCode: pickCourseCode(p.organizations),
    employeeType: pickEmployeeType(p.organizations),
    displayName: firstString(p.names?.find((n) => n?.metadata?.primary)?.displayName, p.names?.[0]?.displayName),
  };
}

/**
 * Fetch and map the signed-in user's directory profile using their OAuth access
 * token. Returns { ok, data, raw } or { ok:false, error }. Never throws.
 */
export async function fetchGoogleDirectoryProfile({ accessToken, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    return { ok: false, error: { code: 'NO_ACCESS_TOKEN', message: 'A Google access token is required.' } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${PEOPLE_API_URL}?personFields=${encodeURIComponent(PERSON_FIELDS)}&sources=READ_SOURCE_TYPE_DOMAIN_PROFILE&sources=READ_SOURCE_TYPE_PROFILE`;
    const response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${accessToken.trim()}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, error: { code: 'UPSTREAM_ERROR', message: `People API returned HTTP ${response.status}.`, status: response.status } };
    }
    const raw = await response.json();
    return { ok: true, data: mapPeopleProfile(raw), raw };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { ok: false, error: { code: 'TIMEOUT', message: `People API did not respond within ${timeoutMs}ms.` } };
    }
    return { ok: false, error: { code: 'NETWORK_ERROR', message: error?.message ?? 'People API request failed.' } };
  } finally {
    clearTimeout(timer);
  }
}
