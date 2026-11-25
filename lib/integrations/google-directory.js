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
// The admin-set Employee ID is absent from people/me; only the directory
// search (domain profile) returns it. Same approach as sld-orientation.
const DIRECTORY_SEARCH_URL = 'https://people.googleapis.com/v1/people:searchDirectoryPeople';
export const DIRECTORY_SCOPE = 'https://www.googleapis.com/auth/directory.readonly';
export const ORGANIZATION_SCOPE = 'https://www.googleapis.com/auth/user.organization.read';
const PERSON_FIELDS = 'emailAddresses,organizations,externalIds,names,photos';
const SEARCH_READ_MASK = 'emailAddresses,externalIds,organizations';
// Phone, addresses, managers and locations are never requested.

// Photos are kept only from Google's own image host over https.
const GOOGLE_PHOTO_HOST = /(^|\.)googleusercontent\.com$/i;
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

function primaryOrganization(organizations = []) {
  const orgs = Array.isArray(organizations) ? organizations : [];
  return orgs.find((o) => o?.metadata?.primary) ?? orgs[0] ?? {};
}

function pickPhotoUrl(photos = []) {
  const list = Array.isArray(photos) ? photos : [];
  const photo = list.find((entry) => entry?.metadata?.primary && entry.url) ?? list.find((entry) => entry?.url);
  try {
    const url = new URL(String(photo?.url ?? ''));
    return url.protocol === 'https:' && GOOGLE_PHOTO_HOST.test(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Map a People API `person` resource to the directory fields we persist.
 * Pure and defensive: unknown shapes yield nulls rather than throwing.
 */
export function mapPeopleProfile(person = {}) {
  const p = person && typeof person === 'object' ? person : {};
  const org = primaryOrganization(p.organizations);
  return {
    email: pickEmail(p.emailAddresses),
    employeeId: pickEmployeeId(p.externalIds, p.organizations),
    courseCode: pickCourseCode(p.organizations),
    employeeType: pickEmployeeType(p.organizations),
    displayName: firstString(p.names?.find((n) => n?.metadata?.primary)?.displayName, p.names?.[0]?.displayName),
    department: firstString(org.department),
    jobTitle: firstString(org.title),
    photoUrl: pickPhotoUrl(p.photos),
  };
}

function hasExactEmail(person, email) {
  const wanted = email.trim().toLowerCase();
  return (person?.emailAddresses ?? []).some((entry) => String(entry?.value ?? '').trim().toLowerCase() === wanted);
}

/** Search entry values win where present (the admin-set Employee ID);
 *  people/me values fill every other field. */
function mergeProfiles(me, search) {
  if (!search) return me;
  const merged = { ...me };
  for (const key of ['employeeId', 'courseCode', 'employeeType', 'department', 'jobTitle']) {
    if (key === 'employeeId' ? search[key] : !merged[key] && search[key]) merged[key] = search[key];
  }
  return merged;
}

async function searchOwnDirectoryEntry({ accessToken, email, fetchImpl, signal }) {
  const url = new URL(DIRECTORY_SEARCH_URL);
  url.searchParams.set('query', email.trim());
  url.searchParams.set('readMask', SEARCH_READ_MASK);
  url.searchParams.set('sources', 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE');
  const response = await fetchImpl(url.toString(), {
    headers: { authorization: `Bearer ${accessToken}` },
    signal,
  });
  if (!response.ok) return { status: response.status, profile: null };
  const body = await response.json();
  // Only the entry with exactly the signed-in email is ever used: a name
  // search can return colleagues.
  const person = (body?.people ?? []).find((entry) => hasExactEmail(entry, email));
  return { status: response.status, profile: person ? mapPeopleProfile(person) : null };
}

export function directoryIdentityMatches(signedInEmail, directoryEmail) {
  const signedIn = typeof signedInEmail === 'string' ? signedInEmail.trim().toLowerCase() : '';
  const directory = typeof directoryEmail === 'string' ? directoryEmail.trim().toLowerCase() : '';
  return Boolean(signedIn && directory && signedIn === directory);
}

/**
 * Fetch and map the signed-in user's directory profile using their OAuth access
 * token. When `email` is given, also runs the directory search for exactly that
 * address. Returns { ok, data, searchStatus } or { ok:false, error }. Never
 * throws; a failed search never fails the read.
 */
export async function fetchGoogleDirectoryProfile({
  accessToken, email = null, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
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
    const me = mapPeopleProfile(await response.json());

    let search = { status: null, profile: null };
    if (typeof email === 'string' && email.trim()) {
      try {
        search = await searchOwnDirectoryEntry({
          accessToken: accessToken.trim(), email, fetchImpl, signal: controller.signal,
        });
      } catch {
        search = { status: null, profile: null };
      }
    }

    return { ok: true, data: mergeProfiles(me, search.profile), searchStatus: search.status };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { ok: false, error: { code: 'TIMEOUT', message: `People API did not respond within ${timeoutMs}ms.` } };
    }
    return { ok: false, error: { code: 'NETWORK_ERROR', message: error?.message ?? 'People API request failed.' } };
  } finally {
    clearTimeout(timer);
  }
}
