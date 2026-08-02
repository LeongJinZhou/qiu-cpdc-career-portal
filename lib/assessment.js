import { createHash } from 'node:crypto';

export const ASSESSMENT_AUTHOR_ROLES = new Set([
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'ACADEMIC_SUPERVISOR',
  'CPDC_ADMIN',
  'SUPER_ADMIN',
]);

export const ASSESSMENT_STUDENT_ROLES = new Set(['STUDENT']);
export const ASSESSMENT_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const ASSESSMENT_MAX_TEXT_LENGTH = 120_000;

const EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'txt']);
const MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/octet-stream',
]);

export class AssessmentParseError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'AssessmentParseError';
    this.code = 'ASSESSMENT_PARSE_FAILED';
    this.status = 400;
    this.details = details;
  }
}

export function canAuthorAssessments(role) {
  return ASSESSMENT_AUTHOR_ROLES.has(role);
}

export function canReadAssessments(role) {
  return canAuthorAssessments(role) || ASSESSMENT_STUDENT_ROLES.has(role);
}

function extensionOf(fileName = '') {
  return String(fileName).toLowerCase().split('.').pop() ?? '';
}

function safeTitle(fileName = '') {
  return String(fileName).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Imported assessment';
}

function normalizeLines(text) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean);
}

function questionStart(line) {
  const match = line.match(/^(?:q(?:uestion)?\s*)?(\d+)\s*[.)\-:]\s*(.+)$/i);
  return match ? { number: Number(match[1]), prompt: match[2].trim() } : null;
}

function optionStart(line) {
  const match = line.match(/^([A-H])\s*[.)\-:]\s+(.+)$/i);
  return match ? { label: match[1].toUpperCase(), text: match[2].trim() } : null;
}

function answerIndex(raw, options) {
  const value = String(raw ?? '').replace(/[.。]$/, '').trim();
  const letter = value.match(/^([A-H])(?:\s|$)/i);
  if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;
  if (/^\d+$/.test(value)) {
    const oneBased = Number(value);
    if (oneBased >= 1 && oneBased <= options.length) return oneBased - 1;
  }
  const normalized = value.toLowerCase();
  const match = options.findIndex((option) => option.toLowerCase() === normalized);
  return match >= 0 ? match : -1;
}

function parseNumber(raw, fallback = null) {
  const parsed = Number(String(raw ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Parse the human-friendly import template into a reviewable assessment draft.
 * Correct answers must be explicit; the platform never guesses an answer key.
 */
export function parseAssessmentText(text, { fallbackTitle = 'Imported assessment' } = {}) {
  const lines = normalizeLines(text);
  if (!lines.length) throw new AssessmentParseError('The document contains no readable text. A scanned image-only PDF needs OCR before it can be imported.');

  let title = fallbackTitle;
  let instructions = '';
  let timeLimitMinutes = null;
  let passMark = 0.6;
  const questions = [];
  let current = null;

  const finish = () => {
    if (!current) return;
    const errors = [];
    if (!current.prompt) errors.push(`Question ${current.number} has no question text.`);
    if (current.options.length < 2) errors.push(`Question ${current.number} needs at least two options.`);
    if (current.answerIndex < 0 || current.answerIndex >= current.options.length) errors.push(`Question ${current.number} needs a valid Answer: line.`);
    if (errors.length) throw new AssessmentParseError('The assessment draft needs correction before it can be published.', errors);
    questions.push({
      order: questions.length + 1,
      prompt: current.prompt,
      type: current.options.length === 2 && current.options.every((option) => /^(true|false)$/i.test(option)) ? 'TRUE_FALSE' : 'SINGLE_CHOICE',
      options: current.options,
      correctOptionIndexes: [current.answerIndex],
      category: current.category || null,
      explanation: current.explanation || null,
      points: current.points || 1,
    });
    current = null;
  };

  for (const line of lines) {
    const titleMatch = line.match(/^title\s*[:\-]\s*(.+)$/i);
    if (titleMatch && !current) {
      title = titleMatch[1].trim();
      continue;
    }
    const instructionsMatch = line.match(/^(?:instructions?|directions?)\s*[:\-]\s*(.+)$/i);
    if (instructionsMatch && !current) {
      instructions = instructionsMatch[1].trim();
      continue;
    }
    const timeMatch = line.match(/^(?:time|duration|time limit)\s*[:\-]\s*(.+)$/i);
    if (timeMatch && !current) {
      timeLimitMinutes = parseNumber(timeMatch[1], null);
      continue;
    }
    const passMatch = line.match(/^(?:pass(?:ing)?\s+mark|pass\s+score)\s*[:\-]\s*(.+)$/i);
    if (passMatch && !current) {
      const parsed = parseNumber(passMatch[1], null);
      if (parsed != null) passMark = parsed > 1 ? parsed / 100 : parsed;
      continue;
    }

    const start = questionStart(line);
    if (start) {
      finish();
      const inlineCategory = start.prompt.match(/^category\s*[:\-]\s*(.+)$/i);
      current = {
        number: start.number,
        prompt: inlineCategory ? '' : start.prompt,
        options: [],
        answerIndex: -1,
        category: inlineCategory ? inlineCategory[1].trim() : '',
        explanation: '',
        points: 1,
      };
      continue;
    }

    if (!current) continue;
    const option = optionStart(line);
    if (option) {
      current.options.push(option.text);
      continue;
    }
    const answerMatch = line.match(/^(?:answer|correct(?:\s+answer)?|key)\s*[:\-]\s*(.+)$/i);
    if (answerMatch) {
      current.answerIndex = answerIndex(answerMatch[1], current.options);
      continue;
    }
    const categoryMatch = line.match(/^(?:category|topic|skill)\s*[:\-]\s*(.+)$/i);
    if (categoryMatch) {
      current.category = categoryMatch[1].trim();
      continue;
    }
    const pointsMatch = line.match(/^points?\s*[:\-]\s*(.+)$/i);
    if (pointsMatch) {
      current.points = Math.max(1, Math.round(parseNumber(pointsMatch[1], 1)));
      continue;
    }
    const explanationMatch = line.match(/^explanation\s*[:\-]\s*(.+)$/i);
    if (explanationMatch) {
      current.explanation = explanationMatch[1].trim();
      continue;
    }
    if (!current.options.length) current.prompt = `${current.prompt} ${line}`.trim();
  }
  finish();

  if (!questions.length) {
    throw new AssessmentParseError('No questions were found. Use numbered questions followed by A/B/C/D options and an Answer: line.');
  }
  if (!(passMark > 0 && passMark <= 1)) {
    throw new AssessmentParseError('Pass mark must be between 1% and 100%.');
  }
  return {
    title: title.slice(0, 180),
    instructions: instructions.slice(0, 2000) || null,
    timeLimitMinutes: timeLimitMinutes && timeLimitMinutes > 0 ? Math.min(600, Math.round(timeLimitMinutes)) : null,
    passMark,
    questions,
  };
}

async function extractPdfText(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalSupported: false }).promise;
  const lines = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const grouped = new Map();
    for (const item of content.items ?? []) {
      if (!item.str) continue;
      const y = Math.round((item.transform?.[5] ?? 0) / 2) * 2;
      grouped.set(y, `${grouped.get(y) ?? ''} ${item.str}`.trim());
    }
    lines.push(...[...grouped.entries()].sort((a, b) => b[0] - a[0]).map(([, value]) => value));
  }
  const text = lines.join('\n').trim();
  if (!text) throw new AssessmentParseError('This PDF has no selectable text. Scanned image-only PDFs need OCR before import.');
  return text;
}

async function extractWordText(buffer) {
  const wordExtractorModule = await import('word-extractor');
  const WordExtractor = wordExtractorModule.default ?? wordExtractorModule;
  const document = await new WordExtractor().extract(buffer);
  return document.getBody().trim();
}

export async function extractAssessmentText(file) {
  const name = String(file?.name ?? 'assessment').trim();
  const extension = extensionOf(name);
  const mime = String(file?.type ?? '').toLowerCase();
  if (!EXTENSIONS.has(extension) || (mime && !MIME_TYPES.has(mime))) {
    throw new AssessmentParseError('Choose a PDF, Word document (.doc/.docx), or UTF-8 text file.');
  }
  if (!file || typeof file.arrayBuffer !== 'function') throw new AssessmentParseError('The uploaded file could not be read.');
  if (file.size > ASSESSMENT_MAX_FILE_BYTES) throw new AssessmentParseError('The file is too large. The maximum is 8 MB.');
  const buffer = Buffer.from(await file.arrayBuffer());
  let text;
  if (extension === 'txt') text = buffer.toString('utf8');
  else if (extension === 'pdf') text = await extractPdfText(buffer);
  else text = await extractWordText(buffer);
  if (!text.trim()) throw new AssessmentParseError('The document contains no readable text.');
  if (text.length > ASSESSMENT_MAX_TEXT_LENGTH) throw new AssessmentParseError('The document contains too much text. Keep an assessment under 120,000 extracted characters.');
  return {
    text,
    sourceFileName: name.slice(0, 240),
    sourceFileType: extension,
    sourceTextHash: createHash('sha256').update(text).digest('hex'),
  };
}

export function publicQuestion(question) {
  return {
    id: question.id,
    order: question.order,
    prompt: question.prompt,
    type: question.type,
    options: question.options,
    category: question.category,
    points: question.points,
    explanation: question.explanation,
  };
}

export function scoreAssessment(questions, answers) {
  let points = 0;
  let earned = 0;
  const breakdown = questions.map((question) => {
    const possible = Math.max(1, Number(question.points ?? 1));
    points += possible;
    const selected = Number(answers?.[question.id]);
    const correct = question.correctOptionIndexes.includes(selected);
    if (correct) earned += possible;
    return { questionId: question.id, correct, earned: correct ? possible : 0, possible };
  });
  const score = points ? earned / points : 0;
  return { score, earned, points, breakdown };
}
