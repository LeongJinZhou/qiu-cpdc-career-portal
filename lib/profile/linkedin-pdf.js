// Read a LinkedIn "Save to PDF" profile into profile and CV fields.
//
// LinkedIn's sign-in API only returns name, email and photo; headline, About,
// jobs, education and skills are not available to ordinary apps. The PDF a
// member downloads from their own profile ("More -> Save to PDF") is the one
// sanctioned way to bring that data across, and the student reviews every
// field before anything is saved.
//
// The layout is two columns: a narrow sidebar (Contact, Top Skills, Languages,
// Certifications, Honors-Awards) and the main column (name, headline,
// location, Summary, Experience, Education). `extractLinkedInLines` turns the
// PDF into positioned lines; `parseLinkedInLines` is pure and unit-tested.

const MAIN_HEADINGS = new Set([
  'summary', 'experience', 'education', 'projects', 'publications', 'volunteer experience',
  'licenses & certifications', 'honors & awards', 'courses', 'skills',
]);
const SIDE_HEADINGS = new Set([
  'contact', 'top skills', 'languages', 'certifications', 'honors-awards', 'publications', 'patents',
]);

const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_POINT = `(?:${MONTH}\\s+\\d{4}|\\d{4})`;
const DATE_RANGE = new RegExp(`^(${DATE_POINT})\\s*[-–]\\s*(present|${DATE_POINT})(?:\\s*\\(.*\\))?$`, 'i');
const YEARS_IN_PARENS = new RegExp(`\\((${DATE_POINT})\\s*[-–]\\s*(present|${DATE_POINT})\\)`, 'i');
const DURATION_ONLY = /^(?:less than a year|\d+\s+years?(?:\s+\d+\s+months?)?|\d+\s+months?)$/i;
const PAGE_FOOTER = /^page\s+\d+\s+of\s+\d+$/i;

// "Kuala Lumpur, Malaysia": capitalised words, comma separated, no digits.
const PLACE = /^[A-Z][A-Za-z.' -]+(?:,\s*[A-Z][A-Za-z.' -]+){1,3}$/;

// Matches the bio limit in lib/auth/identity.js (studentProfileSchema).
const MAX_TEXT = 1200;
// Stops a hostile PDF with millions of tiny text items.
const MAX_TEXT_ITEMS = 20000;

function clean(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/** Cut at the last whole word that fits. */
function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : text.slice(0, max)).trim();
}

function capitalise(value) {
  return value.toLowerCase() === 'present' ? 'Present' : value;
}

/** Split one column's lines into { heading -> lines }, plus the lines before
 *  the first heading. */
function sections(lines, headings) {
  const result = { _header: [] };
  let current = '_header';
  for (const line of lines) {
    const key = line.text.toLowerCase();
    if (headings.has(key)) {
      current = key;
      result[current] = result[current] ?? [];
      continue;
    }
    (result[current] = result[current] ?? []).push(line);
  }
  return result;
}

function parseHeader(headerLines) {
  if (!headerLines.length) return { name: '', headline: '', location: '' };
  const maxSize = Math.max(...headerLines.map((line) => line.size));
  const nameIndex = headerLines.findIndex((line) => line.size === maxSize);
  const rest = headerLines.slice(nameIndex + 1).map((line) => line.text);
  return {
    name: headerLines[nameIndex].text,
    headline: (rest.length >= 2 ? rest.slice(0, -1) : rest).join(' '),
    location: rest.length >= 2 ? rest[rest.length - 1] : '',
  };
}

function sameSize(a, b) {
  return Math.abs(a.size - b.size) <= 0.25;
}

function parseExperience(lines) {
  if (!lines.length) return [];

  const entries = [];
  let lastCompany = '';
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].text.match(DATE_RANGE);
    if (!match || i === 0) continue;

    // A long title wraps: take up to three lines of the title's size.
    const titleLine = lines[i - 1];
    let titleStart = i - 1;
    while (
      titleStart > 0
      && i - titleStart < 3
      && sameSize(lines[titleStart - 1], titleLine)
      && !DATE_RANGE.test(lines[titleStart - 1].text)
      && !DURATION_ONLY.test(lines[titleStart - 1].text)
    ) {
      titleStart -= 1;
    }

    // The company line is larger than the title. A "2 years 1 month" line
    // between them means several roles at one company.
    const prev = lines[titleStart - 1];
    let headerStart = titleStart;
    if (prev && DURATION_ONLY.test(prev.text) && lines[titleStart - 2]) {
      lastCompany = lines[titleStart - 2].text;
      headerStart = titleStart - 2;
    } else if (prev && prev.size > titleLine.size + 0.25 && !DATE_RANGE.test(prev.text)) {
      lastCompany = prev.text;
      headerStart = titleStart - 1;
    }
    entries.push({
      headerStart,
      dateIndex: i,
      title: clean(lines.slice(titleStart, i).map((line) => line.text).join(' ')),
      organisation: lastCompany,
      startDate: capitalise(match[1]),
      endDate: capitalise(match[2]),
    });
  }

  return entries.map((entry, index) => {
    const end = entries[index + 1]?.headerStart ?? lines.length;
    let body = lines.slice(entry.dateIndex + 1, end);
    // The line right after the dates is the job location when it reads like
    // a place ("Kuala Lumpur, Malaysia"); otherwise it is description.
    if (body.length > 1 && body[0].text.length <= 60 && PLACE.test(body[0].text)) {
      body = body.slice(1);
    }
    return {
      title: entry.title,
      organisation: entry.organisation,
      startDate: entry.startDate,
      endDate: entry.endDate,
      description: clean(body.map((line) => line.text).join(' ')).slice(0, 800),
    };
  });
}

function parseEducation(lines) {
  if (!lines.length) return [];
  const small = Math.min(...lines.map((line) => line.size));
  const entries = [];
  for (const line of lines) {
    if (line.size > small + 0.25 || !entries.length) {
      entries.push({ organisation: line.text, detail: [] });
    } else {
      entries[entries.length - 1].detail.push(line.text);
    }
  }
  return entries.map(({ organisation, detail }) => {
    const text = clean(detail.join(' '));
    const years = text.match(YEARS_IN_PARENS);
    const title = clean(text.split(' · ')[0].replace(YEARS_IN_PARENS, '')) || organisation;
    return {
      title,
      organisation,
      startDate: years ? capitalise(years[1]) : '',
      endDate: years ? capitalise(years[2]) : '',
      description: '',
    };
  });
}

/**
 * @param {{text: string, size: number, column: 'side'|'main'}[]} rawLines
 */
export function parseLinkedInLines(rawLines = []) {
  const lines = (Array.isArray(rawLines) ? rawLines : [])
    .map((line) => ({ ...line, text: clean(line?.text), size: Number(line?.size) || 0 }))
    .filter((line) => line.text && !PAGE_FOOTER.test(line.text));

  const side = sections(lines.filter((line) => line.column === 'side'), SIDE_HEADINGS);
  const main = sections(lines.filter((line) => line.column !== 'side'), MAIN_HEADINGS);
  const texts = (list) => (list ?? []).map((line) => line.text);

  const header = parseHeader(main._header);
  const hasLinkedInSection = ['experience', 'summary', 'education'].some((key) => main[key])
    || ['top skills', 'contact'].some((key) => side[key]);

  return {
    looksLikeLinkedIn: Boolean(header.name && hasLinkedInSection),
    name: header.name,
    headline: header.headline.slice(0, 220),
    location: header.location,
    summary: clip(clean(texts(main.summary).join(' ')), MAX_TEXT),
    skills: texts(side['top skills']).slice(0, 20),
    languages: texts(side.languages),
    certifications: texts(side.certifications),
    honors: texts(side['honors-awards']),
    experience: parseExperience(main.experience ?? []).slice(0, 20),
    education: parseEducation(main.education ?? []).slice(0, 20),
  };
}

/**
 * Pull positioned text lines out of the PDF. The sidebar is the left ~third
 * of the page in LinkedIn's export.
 */
export async function extractLinkedInLines(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Text only: no font rendering, no eval, no network fetches.
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer), useWorkerFetch: false, isEvalSupported: false, disableFontFace: true, verbosity: 0,
  });
  try {
    const document = await loadingTask.promise;
    const lines = [];
    let itemCount = 0;
    const pageLimit = Math.min(document.numPages, 10);
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const sidebarEdge = page.getViewport({ scale: 1 }).width * 0.32;
      const content = await page.getTextContent();
      itemCount += content.items?.length ?? 0;
      if (itemCount > MAX_TEXT_ITEMS) throw new Error('Too much text for a profile PDF.');

      const pieces = [];
      for (const item of content.items ?? []) {
        if (!item.str?.trim()) continue;
        const [a, b, , , x, y] = item.transform ?? [];
        pieces.push({
          column: x < sidebarEdge ? 'side' : 'main',
          x,
          y,
          size: Math.round(Math.hypot(a ?? 0, b ?? 0) * 10) / 10 || Number(item.height) || 0,
          text: item.str,
        });
      }
      lines.push(...groupIntoLines(pieces.filter((piece) => piece.column === 'side')));
      lines.push(...groupIntoLines(pieces.filter((piece) => piece.column === 'main')));
    }
    return lines;
  } finally {
    await loadingTask.destroy();
  }
}

/** Pieces within 2pt of the same baseline are one line, read left to right. */
function groupIntoLines(pieces) {
  const sorted = [...pieces].sort((left, right) => right.y - left.y);
  const lines = [];
  for (const piece of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.y - piece.y) <= 2) {
      line.parts.push(piece);
      line.size = Math.max(line.size, piece.size);
    } else {
      lines.push({ column: piece.column, y: piece.y, size: piece.size, parts: [piece] });
    }
  }
  return lines.map((line) => ({
    column: line.column,
    size: line.size,
    text: line.parts.sort((l, r) => l.x - r.x).map((part) => part.text).join(' '),
  }));
}
