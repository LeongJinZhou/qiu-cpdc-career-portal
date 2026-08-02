const STUDENT_ID_REGEX = /^QIU-(20\d{2}(0[1-9]|1[0-2]))-(\d{6})$/;

export class StudentIdValidationError extends Error {
  constructor(message, value) {
    super(message);
    this.name = 'StudentIdValidationError';
    this.code = 'STUDENT_ID_INVALID';
    this.value = value;
  }
}

function assertIntakeYearMonth(intakeYearMonth) {
  if (!Number.isInteger(intakeYearMonth)) {
    throw new StudentIdValidationError('Student ID intake year/month must be an integer.', intakeYearMonth);
  }

  const month = intakeYearMonth % 100;
  const year = Math.trunc(intakeYearMonth / 100);

  if (year < 2000 || year > 2099 || month < 1 || month > 12) {
    throw new StudentIdValidationError('Student ID intake year/month must be in YYYYMM format.', intakeYearMonth);
  }
}

function assertSequence(sequence) {
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 999999) {
    throw new StudentIdValidationError('Student ID sequence must be a six-digit integer.', sequence);
  }
}

export function parseStudentId(value) {
  const match = STUDENT_ID_REGEX.exec(value ?? '');

  if (!match) {
    throw new StudentIdValidationError(
      'Student ID must match QIU-YYYYMM-NNNNNN.',
      value,
    );
  }

  return {
    intakeYearMonth: Number(match[1]),
    sequence: Number(match[3]),
  };
}

export function formatStudentId({ intakeYearMonth, sequence }) {
  assertIntakeYearMonth(intakeYearMonth);
  assertSequence(sequence);

  return `QIU-${String(intakeYearMonth)}-${String(sequence).padStart(6, '0')}`;
}

export function isStudentId(value) {
  try {
    parseStudentId(value);
    return true;
  } catch (error) {
    if (error instanceof StudentIdValidationError) {
      return false;
    }
    throw error;
  }
}
