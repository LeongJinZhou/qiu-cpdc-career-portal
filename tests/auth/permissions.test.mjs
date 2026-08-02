import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCanonicalIdentity,
  getAuthenticatedIdentity,
  parseProfilePatchBody,
  toIdentityRouteError,
  validateLogbookPayload,
} from '../../lib/auth/identity.js';
import {
  hasCapability,
  requireCapability,
} from '../../lib/auth/permissions.js';

function createIdentity({
  userId = 'user-1',
  role = 'STUDENT',
  student = {
    id: 'student-1',
    facultyId: 'computing_engineering',
    programmeId: 'programme-1',
  },
  assignments = [],
} = {}) {
  return {
    user: {
      id: userId,
      role,
    },
    student,
    assignments,
  };
}

test('student can access only their own student record', () => {
  const identity = createIdentity();

  assert.equal(
    hasCapability(identity, 'student.read', {
      studentId: 'student-1',
      facultyId: 'computing_engineering',
      programmeId: 'programme-1',
    }),
    true,
  );

  assert.equal(
    hasCapability(identity, 'student.read', {
      studentId: 'student-2',
      facultyId: 'computing_engineering',
      programmeId: 'programme-1',
    }),
    false,
  );
});

test('requireCapability returns a structured 403 when a student targets another student record', () => {
  const identity = createIdentity();

  assert.throws(
    () => requireCapability(identity, 'student.read', {
      studentId: 'student-2',
      facultyId: 'computing_engineering',
      programmeId: 'programme-1',
    }),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, 'INSUFFICIENT_CAPABILITY');
      assert.match(error.message, /not allowed|forbidden/i);
      return true;
    },
  );
});

test('HEAD_OF_PROGRAMME is limited to their assigned programme scope', () => {
  const identity = createIdentity({
    role: 'HEAD_OF_PROGRAMME',
    student: null,
    assignments: [
      {
        role: 'HEAD_OF_PROGRAMME',
        scopeType: 'PROGRAMME',
        scopeValue: 'programme-1',
      },
    ],
  });

  assert.equal(
    hasCapability(identity, 'student.read', {
      studentId: 'student-10',
      facultyId: 'computing_engineering',
      programmeId: 'programme-1',
    }),
    true,
  );

  assert.equal(
    hasCapability(identity, 'student.read', {
      studentId: 'student-11',
      facultyId: 'computing_engineering',
      programmeId: 'programme-2',
    }),
    false,
  );
});

test('FACULTY_COORDINATOR is limited to their assigned faculty scope', () => {
  const identity = createIdentity({
    role: 'FACULTY_COORDINATOR',
    student: null,
    assignments: [
      {
        role: 'FACULTY_COORDINATOR',
        scopeType: 'FACULTY',
        scopeValue: 'computing_engineering',
      },
    ],
  });

  assert.equal(
    hasCapability(identity, 'logbook.read', {
      studentId: 'student-10',
      facultyId: 'computing_engineering',
      programmeId: 'programme-1',
    }),
    true,
  );

  assert.equal(
    hasCapability(identity, 'logbook.read', {
      studentId: 'student-11',
      facultyId: 'business',
      programmeId: 'programme-2',
    }),
    false,
  );
});

test('CPDC_ADMIN has global read/write student and logbook access', () => {
  const identity = createIdentity({
    role: 'CPDC_ADMIN',
    student: null,
    assignments: [],
  });

  assert.equal(
    hasCapability(identity, 'student.read', {
      studentId: 'student-10',
      facultyId: 'business',
      programmeId: 'programme-7',
    }),
    true,
  );

  assert.equal(
    hasCapability(identity, 'logbook.write', {
      studentId: 'student-10',
      facultyId: 'business',
      programmeId: 'programme-7',
    }),
    true,
  );
});

test('SUPER_ADMIN has university-wide identity management capability', () => {
  const identity = createIdentity({
    role: 'SUPER_ADMIN',
    student: null,
    assignments: [
      {
        role: 'SUPER_ADMIN',
        scopeType: 'GLOBAL',
        scopeValue: 'GLOBAL',
      },
    ],
  });

  assert.equal(
    hasCapability(identity, 'identity.manage', {
      studentId: 'student-99',
      facultyId: 'medicine',
      programmeId: 'programme-99',
    }),
    true,
  );

  assert.doesNotThrow(() => requireCapability(identity, 'identity.manage', {
    studentId: 'student-99',
    facultyId: 'medicine',
    programmeId: 'programme-99',
  }));
});

test('mixed primary role and non-global assignment does not escalate to CPDC_ADMIN global access', () => {
  const identity = createIdentity({
    role: 'HEAD_OF_PROGRAMME',
    student: null,
    assignments: [
      {
        role: 'CPDC_ADMIN',
        scopeType: 'FACULTY',
        scopeValue: 'computing_engineering',
      },
      {
        role: 'HEAD_OF_PROGRAMME',
        scopeType: 'PROGRAMME',
        scopeValue: 'programme-1',
      },
    ],
  });

  assert.equal(
    hasCapability(identity, 'student.read', {
      studentId: 'student-12',
      facultyId: 'business',
      programmeId: 'programme-77',
    }),
    false,
  );
});

test('getAuthenticatedIdentity returns the canonical safe identity payload from the live database user', async () => {
  const request = {
    cookies: {
      get(name) {
        return name === 'qiu_auth_session' ? { value: 'signed-cookie' } : undefined;
      },
    },
  };

  const identity = await getAuthenticatedIdentity(request, {
    readSessionCookieImpl: async () => ({
      user: {
        id: 'user-1',
      },
    }),
    prismaClient: {
      user: {
        async findUnique() {
          return {
            id: 'user-1',
            email: 'student@qiu.edu.my',
            normalizedEmail: 'student@qiu.edu.my',
            name: 'Student User',
            role: 'STUDENT',
            avatarUrl: 'https://example.com/avatar.png',
            firebaseUid: 'firebase-secret',
            loginAllowed: true,
            accountStatus: 'ACTIVE',
            student: {
              id: 'student-1',
              matricNo: 'QIU-202404-007157',
              academicYear: 2,
              facultyId: 'computing_engineering',
              programmeId: 'programme-1',
              faculty: {
                id: 'computing_engineering',
                name: 'Faculty of Computing and Engineering',
                code: 'FCE',
              },
              programme: {
                id: 'programme-1',
                name: 'Computer Science',
                level: 'BACHELOR',
              },
            },
            roleAssignments: [],
          };
        },
      },
    },
  });

  assert.equal(identity.user.id, 'user-1');
  assert.equal(identity.role, 'STUDENT');
  assert.equal(identity.student.id, 'student-1');
  assert.equal(identity.faculty.code, 'FCE');
  assert.equal(identity.programme.name, 'Computer Science');
  assert.equal(identity.capabilities.includes('student.read'), true);
  assert.equal(identity.scopes.some((scope) => scope.type === 'SELF' && scope.studentId === 'student-1'), true);
  assert.equal('firebaseUid' in identity.user, false);
  assert.equal('loginAllowed' in identity.user, false);
  assert.equal('accountStatus' in identity.user, false);
});

test('buildCanonicalIdentity omits sensitive role-assignment metadata from the canonical payload', () => {
  const identity = buildCanonicalIdentity({
    id: 'user-1',
    email: 'student@qiu.edu.my',
    normalizedEmail: 'student@qiu.edu.my',
    name: 'Student User',
    role: 'FACULTY_COORDINATOR',
    avatarUrl: null,
    student: null,
    roleAssignments: [
      {
        id: 'ra-1',
        role: 'FACULTY_COORDINATOR',
        scopeType: 'FACULTY',
        scopeValue: 'computing_engineering',
        metadata: {
          note: 'internal',
          secret: 'top-secret',
          tokenHash: 'abc123',
          privateKey: 'key-data',
        },
      },
    ],
  });

  assert.deepEqual(identity.assignments, [
    {
      id: 'ra-1',
      role: 'FACULTY_COORDINATOR',
      scopeType: 'FACULTY',
      scopeValue: 'computing_engineering',
    },
  ]);

  assert.equal(JSON.stringify(identity).includes('top-secret'), false);
  assert.equal(JSON.stringify(identity).includes('abc123'), false);
  assert.equal(JSON.stringify(identity).includes('key-data'), false);
});

test('getAuthenticatedIdentity throws a typed 401 when there is no active session cookie', async () => {
  const request = {
    cookies: {
      get() {
        return undefined;
      },
    },
  };

  await assert.rejects(
    getAuthenticatedIdentity(request, {
      readSessionCookieImpl: async () => null,
      prismaClient: {
        user: {
          async findUnique() {
            throw new Error('Should not query the database without a session.');
          },
        },
      },
    }),
    (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.code, 'AUTHENTICATION_REQUIRED');
      return true;
    },
  );
});

test('parseProfilePatchBody returns 400 for malformed JSON bodies', async () => {
  await assert.rejects(
    parseProfilePatchBody({
      async json() {
        throw new SyntaxError('Unexpected token');
      },
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.match(error.message, /valid JSON/i);
      return true;
    },
  );
});

test('validateLogbookPayload rejects malformed details, fieldValues, supervisor.email, and supervisor.phone before Prisma', () => {
  assert.throws(
    () => validateLogbookPayload({
      studentId: 'student-1',
      title: 'Weekly practicum',
      details: { bad: true },
      hours: 8,
      entryDate: '2026-08-01',
      fieldValues: 'wrong-shape',
      supervisor: {
        name: 'Supervisor Name',
        email: 'not-an-email',
        phone: { nope: true },
      },
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.match(error.message, /details|fieldValues|email|phone/i);
      return true;
    },
  );
});

test('unauthenticated and unauthorized route-boundary errors preserve 401 and 403 semantics', async () => {
  let unauthenticated;
  try {
    await getAuthenticatedIdentity({
      cookies: {
        get() {
          return undefined;
        },
      },
    }, {
      readSessionCookieImpl: async () => null,
    });
  } catch (error) {
    unauthenticated = error;
  }

  assert.equal(toIdentityRouteError(unauthenticated).status, 401);
  assert.equal(toIdentityRouteError(unauthenticated).code, 'AUTHENTICATION_REQUIRED');

  let unauthorized;
  try {
    requireCapability(createIdentity(), 'student.read', {
      studentId: 'student-2',
      facultyId: 'computing_engineering',
      programmeId: 'programme-1',
    });
  } catch (error) {
    unauthorized = error;
  }

  assert.equal(toIdentityRouteError(unauthorized).status, 403);
  assert.equal(toIdentityRouteError(unauthorized).code, 'INSUFFICIENT_CAPABILITY');
});
