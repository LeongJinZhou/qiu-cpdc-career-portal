import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAdminUser,
  listAdminAudit,
  listAdminUsers,
  requireAdminAccess,
  sanitizeAdminAuditRecord,
  sanitizeAdminUserRecord,
  updateAdminUser,
} from '../../lib/admin/identity-policy.js';

function createIdentity({
  userId = 'actor-1',
  role = 'CPDC_ADMIN',
  assignments = [
    { role: 'CPDC_ADMIN', scopeType: 'FACULTY', scopeValue: 'computing_engineering' },
  ],
  student = null,
} = {}) {
  return {
    user: {
      id: userId,
      role,
      email: 'admin@qiu.edu.my',
      name: 'Admin User',
    },
    role,
    student,
    assignments,
  };
}

function createPrismaStub({
  users = [],
  students = [],
  assignments = [],
  audits = [],
  auditsShouldFail = false,
  outboxConflictOnDuplicate = false,
  failNextOutboxCreate = false,
  outboxFailureExistingEvent = null,
} = {}) {
  const state = {
    users: structuredClone(users),
    students: structuredClone(students),
    assignments: structuredClone(assignments),
    audits: structuredClone(audits),
    outboxEvents: [],
  };

  const operations = {
    auditCreates: 0,
    outboxCreates: 0,
    outboxFailures: 0,
  };

  const programmes = [
    { id: 'programme-1', facultyId: 'computing_engineering', name: 'Computer Science', level: 'BACHELOR' },
    { id: 'programme-2', facultyId: 'business', name: 'Finance', level: 'BACHELOR' },
  ];

  const faculties = [
    { id: 'computing_engineering', code: 'FCE', name: 'Faculty of Computing and Engineering' },
    { id: 'business', code: 'FOB', name: 'Faculty of Business and Management' },
  ];

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function findUserByWhere(where, source = state) {
    if (!where) {
      return null;
    }

    if (where.id) {
      return source.users.find((user) => user.id === where.id) ?? null;
    }

    if (where.normalizedEmail) {
      return source.users.find((user) => user.normalizedEmail === where.normalizedEmail) ?? null;
    }

    if (where.email) {
      return source.users.find((user) => user.email === where.email) ?? null;
    }

    return null;
  }

  function findStudentByWhere(where, source = state) {
    if (!where) {
      return null;
    }

    if (where.userId) {
      return source.students.find((student) => student.userId === where.userId) ?? null;
    }

    if (where.id) {
      return source.students.find((student) => student.id === where.id) ?? null;
    }

    if (where.matricNo) {
      return source.students.find((student) => student.matricNo === where.matricNo) ?? null;
    }

    return null;
  }

  function getAssignmentsForUser(userId, source = state) {
    return source.assignments.filter((assignment) => assignment.userId === userId);
  }

  function buildUserRecord(user, source = state) {
    if (!user) {
      return null;
    }

    const student = findStudentByWhere({ userId: user.id }, source);
    const roleAssignments = getAssignmentsForUser(user.id, source);
    return clone({
      ...user,
      student,
      roleAssignments,
    });
  }

  function createTxState() {
    return {
      users: clone(state.users),
      students: clone(state.students),
      assignments: clone(state.assignments),
      audits: clone(state.audits),
      outboxEvents: clone(state.outboxEvents),
    };
  }

  function makeTransactionSource(txState) {
    return {
      user: {
        async findUnique({ where }) {
          return buildUserRecord(findUserByWhere(where, txState), txState);
        },
        async findFirst({ where }) {
          return buildUserRecord(findUserByWhere(where, txState), txState);
        },
        async create({ data }) {
          const created = {
            id: data.id ?? `user-${txState.users.length + 1}`,
            email: data.email,
            normalizedEmail: data.normalizedEmail,
            name: data.name,
            role: data.role,
            avatarUrl: data.avatarUrl ?? null,
            firebaseUid: data.firebaseUid ?? null,
            loginAllowed: data.loginAllowed,
            accountStatus: data.accountStatus,
            identitySource: data.identitySource,
            createdAt: data.createdAt ?? '2026-08-01T00:00:00.000Z',
            updatedAt: data.updatedAt ?? '2026-08-01T00:00:00.000Z',
          };
          txState.users.push(created);
          return buildUserRecord(created, txState);
        },
        async update({ where, data }) {
          const existing = findUserByWhere(where, txState);
          if (!existing) {
            throw new Error('User not found');
          }

          Object.assign(existing, data);
          return buildUserRecord(existing, txState);
        },
      },
      student: {
        async findFirst({ where }) {
          return clone(findStudentByWhere(where, txState));
        },
        async findUnique({ where }) {
          return clone(findStudentByWhere(where, txState));
        },
        async create({ data }) {
          const created = {
            id: data.id ?? `student-${txState.students.length + 1}`,
            matricNo: data.matricNo,
            intakeYearMonth: data.intakeYearMonth ?? null,
            intakeSequence: data.intakeSequence ?? null,
            academicYear: data.academicYear,
            facultyId: data.facultyId,
            programmeId: data.programmeId,
            userId: data.userId,
          };
          txState.students.push(created);
          return clone(created);
        },
        async update({ where, data }) {
          const existing = findStudentByWhere(where, txState);
          if (!existing) {
            throw new Error('Student not found');
          }

          Object.assign(existing, data);
          return clone(existing);
        },
      },
      roleAssignment: {
        async deleteMany({ where }) {
          txState.assignments = txState.assignments.filter((assignment) => assignment.userId !== where.userId);
          return { count: 1 };
        },
        async createMany({ data }) {
          for (const assignment of data) {
            txState.assignments.push({
              id: assignment.id ?? `assignment-${txState.assignments.length + 1}`,
              userId: assignment.userId,
              role: assignment.role,
              scopeType: assignment.scopeType,
              scopeValue: assignment.scopeValue,
              metadata: assignment.metadata ?? null,
            });
          }
          return { count: data.length };
        },
      },
      faculty: {
        async findUnique({ where }) {
          return clone(faculties.find((faculty) => faculty.id === where.id) ?? null);
        },
      },
      programme: {
        async findUnique({ where }) {
          return clone(programmes.find((programme) => programme.id === where.id) ?? null);
        },
        async findFirst({ where }) {
          return clone(programmes.find((programme) => programme.facultyId === where.facultyId && programme.name === where.name) ?? null);
        },
      },
      auditLog: {
        async create({ data }) {
          if (auditsShouldFail) {
            throw new Error('Audit create failed');
          }

          operations.auditCreates += 1;
          const created = { id: `audit-${txState.audits.length + 1}`, ...data };
          txState.audits.push(created);
          return clone(created);
        },
      },
      auditLogRead: {
        async findMany() {
          return clone(txState.audits);
        },
      },
      outboxEvent: {
        async findUnique({ where }) {
          return clone(txState.outboxEvents.find((event) => event.dedupeKey === where.dedupeKey) ?? null);
        },
        async create({ data }) {
          if (failNextOutboxCreate) {
            failNextOutboxCreate = false;
            operations.outboxFailures += 1;
            if (outboxFailureExistingEvent) {
              state.outboxEvents.push(clone(outboxFailureExistingEvent));
            }
            const error = new Error('Unique constraint failed');
            error.code = 'P2002';
            throw error;
          }

          if (outboxConflictOnDuplicate && txState.outboxEvents.some((event) => event.dedupeKey === data.dedupeKey)) {
            const error = new Error('Unique constraint failed');
            error.code = 'P2002';
            throw error;
          }

          operations.outboxCreates += 1;
          const created = {
            id: `outbox-${txState.outboxEvents.length + 1}`,
            topic: data.topic,
            aggregateType: data.aggregateType,
            aggregateId: data.aggregateId,
            payload: data.payload,
            dedupeKey: data.dedupeKey,
          };
          txState.outboxEvents.push(created);
          return clone(created);
        },
      },
    };
  }

  return {
    prisma: {
      user: {
        async findUnique({ where }) {
          return buildUserRecord(findUserByWhere(where), state);
        },
        async findMany({ select, include, orderBy } = {}) {
          const rows = state.users.map((user) => {
            if (select?.id) {
              return { id: user.id };
            }

            const record = buildUserRecord(user, state);
            if (include?.student?.include) {
              const student = record.student
                ? {
                  ...record.student,
                  faculty: faculties.find((faculty) => faculty.id === record.student.facultyId) ?? null,
                  programme: programmes.find((programme) => programme.id === record.student.programmeId) ?? null,
                }
                : null;
              return { ...record, student };
            }
            return record;
          });

          if (orderBy?.createdAt === 'desc') {
            return rows.reverse();
          }

          return clone(rows);
        },
      },
      auditLog: {
        async findMany({ include, orderBy } = {}) {
          const rows = state.audits.map((audit) => ({
            ...audit,
            actorUser: include?.actorUser && audit.actorUserId
              ? findUserByWhere({ id: audit.actorUserId }, state)
              : null,
          }));

          if (orderBy?.createdAt === 'desc') {
            rows.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
          }

          return clone(rows);
        },
      },
      outboxEvent: {
        async findUnique({ where }) {
          return clone(state.outboxEvents.find((event) => event.dedupeKey === where.dedupeKey) ?? null);
        },
      },
      async $transaction(callback) {
        const txState = createTxState();
        const tx = makeTransactionSource(txState);
        const result = await callback(tx);
        state.users = txState.users;
        state.students = txState.students;
        state.assignments = txState.assignments;
        state.audits = txState.audits;
        state.outboxEvents = txState.outboxEvents;
        return clone(result);
      },
    },
    operations,
    state,
  };
}

test('requireAdminAccess preserves 401 and 403 semantics for admin APIs', () => {
  assert.throws(
    () => requireAdminAccess(null),
    (error) => error.status === 401 && error.code === 'AUTHENTICATION_REQUIRED',
  );

  assert.throws(
    () => requireAdminAccess(createIdentity({ role: 'STUDENT', assignments: [], student: { id: 'student-1' } })),
    (error) => error.status === 403 && error.code === 'INSUFFICIENT_CAPABILITY',
  );

  assert.doesNotThrow(() => requireAdminAccess(createIdentity()));
});

test('unassigned CPDC_ADMIN authenticates admin access but cannot manage targets or list scoped users', async () => {
  const identity = createIdentity({ assignments: [] });
  const { prisma } = createPrismaStub({
    users: [
      {
        id: 'user-1',
        email: 'student@qiu.edu.my',
        normalizedEmail: 'student@qiu.edu.my',
        name: 'Student User',
        role: 'STUDENT',
        avatarUrl: null,
        firebaseUid: null,
        loginAllowed: true,
        accountStatus: 'ACTIVE',
        identitySource: 'MANUAL',
      },
    ],
    students: [
      {
        id: 'student-1',
        userId: 'user-1',
        matricNo: 'QIU-202404-007157',
        facultyId: 'computing_engineering',
        programmeId: 'programme-1',
        academicYear: 2,
      },
    ],
  });

  assert.doesNotThrow(() => requireAdminAccess(identity));

  await assert.rejects(
    createAdminUser({
      identity,
      input: {
        email: 'blocked@qiu.edu.my',
        name: 'Blocked User',
        primaryRole: 'STUDENT',
        loginAllowed: true,
        status: 'INVITED',
        studentProfile: {
          matricNo: 'QIU-202404-007188',
          facultyId: 'computing_engineering',
          programmeId: 'programme-1',
          academicYear: 1,
        },
      },
      prismaClient: prisma,
      requestId: 'req-unassigned-create',
      idempotencyKey: 'unassigned-create',
    }),
    (error) => error.status === 403 && /scope/i.test(error.message),
  );

  const result = await listAdminUsers({
    identity,
    filters: { page: 1, pageSize: 10, query: '', role: '', status: '', facultyId: '', programmeId: '' },
    prismaClient: prisma,
  });

  assert.equal(result.total, 0);
});

test('CPDC_ADMIN can create an allowlisted student only inside their scoped faculty and programme', async () => {
  const { prisma, state } = createPrismaStub();

  const created = await createAdminUser({
    identity: createIdentity(),
    input: {
      email: '  Student.New@QIU.EDU.MY ',
      name: 'Student New',
      primaryRole: 'STUDENT',
      loginAllowed: true,
      status: 'INVITED',
      studentProfile: {
        matricNo: 'QIU-202404-007158',
        facultyId: 'computing_engineering',
        programmeId: 'programme-1',
        academicYear: 2,
      },
      roleAssignments: [
        { role: 'STUDENT', scopeType: 'SELF', scopeValue: 'SELF' },
      ],
    },
    prismaClient: prisma,
    requestId: 'req-create-1',
    idempotencyKey: 'create-user-1',
  });

  assert.equal(created.user.normalizedEmail, 'student.new@qiu.edu.my');
  assert.equal(created.user.firebaseUid, undefined);
  assert.equal(created.user.loginAllowed, true);
  assert.equal(state.users.length, 1);
  assert.equal(state.students[0].facultyId, 'computing_engineering');

  await assert.rejects(
    createAdminUser({
      identity: createIdentity(),
      input: {
        email: 'outside-scope@qiu.edu.my',
        name: 'Outside Scope',
        primaryRole: 'STUDENT',
        loginAllowed: true,
        status: 'INVITED',
        studentProfile: {
          matricNo: 'QIU-202404-007159',
          facultyId: 'business',
          programmeId: 'programme-2',
          academicYear: 2,
        },
      },
      prismaClient: prisma,
      requestId: 'req-create-2',
      idempotencyKey: 'create-user-2',
    }),
    (error) => error.status === 403 && /scope/i.test(error.message),
  );
});

test('only SUPER_ADMIN may assign or escalate privileged roles', async () => {
  const { prisma } = createPrismaStub();

  await assert.rejects(
    createAdminUser({
      identity: createIdentity(),
      input: {
        email: 'faculty.coord@qiu.edu.my',
        name: 'Faculty Coord',
        primaryRole: 'FACULTY_COORDINATOR',
        loginAllowed: true,
        status: 'ACTIVE',
        roleAssignments: [
          {
            role: 'FACULTY_COORDINATOR',
            scopeType: 'FACULTY',
            scopeValue: 'computing_engineering',
          },
        ],
      },
      prismaClient: prisma,
      requestId: 'req-privileged-1',
      idempotencyKey: 'privileged-1',
    }),
    (error) => error.status === 403 && /super admin/i.test(error.message),
  );

  const created = await createAdminUser({
    identity: createIdentity({
      role: 'SUPER_ADMIN',
      assignments: [{ role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeValue: 'GLOBAL' }],
    }),
    input: {
      email: 'faculty.coord@qiu.edu.my',
      name: 'Faculty Coord',
      primaryRole: 'FACULTY_COORDINATOR',
      loginAllowed: true,
      status: 'ACTIVE',
      roleAssignments: [
        {
          role: 'FACULTY_COORDINATOR',
          scopeType: 'FACULTY',
          scopeValue: 'computing_engineering',
        },
      ],
    },
    prismaClient: prisma,
    requestId: 'req-privileged-2',
    idempotencyKey: 'privileged-2',
  });

  assert.equal(created.user.role, 'FACULTY_COORDINATOR');
});

test('createAdminUser returns 409 for duplicate normalized email and duplicate student ID', async () => {
  const { prisma } = createPrismaStub({
    users: [
      {
        id: 'user-1',
        email: 'existing@qiu.edu.my',
        normalizedEmail: 'existing@qiu.edu.my',
        name: 'Existing',
        role: 'STUDENT',
        avatarUrl: null,
        firebaseUid: null,
        loginAllowed: true,
        accountStatus: 'ACTIVE',
        identitySource: 'MANUAL',
      },
    ],
    students: [
      {
        id: 'student-1',
        userId: 'user-1',
        matricNo: 'QIU-202404-007157',
        facultyId: 'computing_engineering',
        programmeId: 'programme-1',
        academicYear: 1,
      },
    ],
  });

  await assert.rejects(
    createAdminUser({
      identity: createIdentity({
        role: 'SUPER_ADMIN',
        assignments: [{ role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeValue: 'GLOBAL' }],
      }),
      input: {
        email: ' Existing@QIU.EDU.MY ',
        name: 'Dup Email',
        primaryRole: 'EMPLOYER',
        loginAllowed: true,
        status: 'INVITED',
      },
      prismaClient: prisma,
      requestId: 'req-dup-email',
      idempotencyKey: 'dup-email',
    }),
    (error) => error.status === 409 && /email/i.test(error.message),
  );

  await assert.rejects(
    createAdminUser({
      identity: createIdentity(),
      input: {
        email: 'another@qiu.edu.my',
        name: 'Dup Student ID',
        primaryRole: 'STUDENT',
        loginAllowed: true,
        status: 'INVITED',
        studentProfile: {
          matricNo: 'QIU-202404-007157',
          facultyId: 'computing_engineering',
          programmeId: 'programme-1',
          academicYear: 2,
        },
      },
      prismaClient: prisma,
      requestId: 'req-dup-student',
      idempotencyKey: 'dup-student',
    }),
    (error) => error.status === 409 && /student id|matric/i.test(error.message),
  );
});

test('successful mutations require audit writes and roll back when the audit write fails', async () => {
  const { prisma, state } = createPrismaStub({
    auditsShouldFail: true,
  });

  await assert.rejects(
    createAdminUser({
      identity: createIdentity({
        role: 'SUPER_ADMIN',
        assignments: [{ role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeValue: 'GLOBAL' }],
      }),
      input: {
        email: 'rollback@qiu.edu.my',
        name: 'Rollback User',
        primaryRole: 'STUDENT',
        loginAllowed: true,
        status: 'INVITED',
        studentProfile: {
          matricNo: 'QIU-202404-007160',
          facultyId: 'computing_engineering',
          programmeId: 'programme-1',
          academicYear: 2,
        },
      },
      prismaClient: prisma,
      requestId: 'req-audit-rollback',
      idempotencyKey: 'audit-rollback',
    }),
    /Audit create failed/,
  );

  assert.equal(state.users.length, 0);
  assert.equal(state.students.length, 0);
  assert.equal(state.outboxEvents.length, 0);
});

test('createAdminUser uses the outbox dedupe key transactionally for idempotent retries', async () => {
  const { prisma, operations, state } = createPrismaStub({
    outboxConflictOnDuplicate: true,
  });

  const args = {
    identity: createIdentity({
      role: 'SUPER_ADMIN',
      assignments: [{ role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeValue: 'GLOBAL' }],
    }),
    input: {
      email: 'idem@qiu.edu.my',
      name: 'Idempotent User',
      primaryRole: 'STUDENT',
      loginAllowed: true,
      status: 'INVITED',
      studentProfile: {
        matricNo: 'QIU-202404-007161',
        facultyId: 'computing_engineering',
        programmeId: 'programme-1',
        academicYear: 1,
      },
    },
    prismaClient: prisma,
    requestId: 'req-idem',
    idempotencyKey: 'idem-1',
  };

  const first = await createAdminUser(args);
  const second = await createAdminUser(args);

  assert.deepEqual(second, first);
  assert.equal(state.users.length, 1);
  assert.equal(state.students.length, 1);
  assert.equal(operations.outboxCreates, 1);
});

test('createAdminUser reloads existing outbox response when the transactional dedupe write races with another request', async () => {
  const { prisma, operations, state } = createPrismaStub({
    failNextOutboxCreate: true,
    outboxFailureExistingEvent: {
      id: 'outbox-existing',
      topic: 'admin.user.created',
      aggregateType: 'User',
      aggregateId: 'user-existing',
      dedupeKey: 'admin.users.create:race-create',
      payload: {
        requestId: 'req-existing',
        response: {
          user: {
            id: 'user-existing',
            email: 'race@qiu.edu.my',
            normalizedEmail: 'race@qiu.edu.my',
            name: 'Race Winner',
            role: 'STUDENT',
            avatarUrl: null,
            loginAllowed: true,
            accountStatus: 'INVITED',
            identitySource: 'MANUAL',
          },
          student: null,
          assignments: [],
        },
      },
    },
  });

  const result = await createAdminUser({
    identity: createIdentity({
      role: 'SUPER_ADMIN',
      assignments: [{ role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeValue: 'GLOBAL' }],
    }),
    input: {
      email: 'race@qiu.edu.my',
      name: 'Race Winner',
      primaryRole: 'EMPLOYER',
      loginAllowed: true,
      status: 'INVITED',
    },
    prismaClient: prisma,
    requestId: 'req-race-create',
    idempotencyKey: 'race-create',
  });

  assert.equal(result.user.id, 'user-existing');
  assert.equal(operations.outboxFailures, 1);
  assert.equal(state.outboxEvents.length, 1);
});

test('updateAdminUser blocks self-lockout and returns safe user and audit payloads', async () => {
  const { prisma } = createPrismaStub({
    users: [
      {
        id: 'admin-1',
        email: 'admin@qiu.edu.my',
        normalizedEmail: 'admin@qiu.edu.my',
        name: 'Admin User',
        role: 'SUPER_ADMIN',
        avatarUrl: 'https://example.com/a.png',
        firebaseUid: 'firebase-secret',
        loginAllowed: true,
        accountStatus: 'ACTIVE',
        identitySource: 'FIREBASE',
      },
    ],
    assignments: [
      {
        id: 'assign-1',
        userId: 'admin-1',
        role: 'SUPER_ADMIN',
        scopeType: 'GLOBAL',
        scopeValue: 'GLOBAL',
        metadata: { privateKey: 'should-not-leak' },
      },
    ],
  });

  await assert.rejects(
    updateAdminUser({
      identity: createIdentity({
        userId: 'admin-1',
        role: 'SUPER_ADMIN',
        assignments: [{ role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeValue: 'GLOBAL' }],
      }),
      targetUserId: 'admin-1',
      input: {
        loginAllowed: false,
      },
      prismaClient: prisma,
      requestId: 'req-self-lockout',
    }),
    (error) => error.status === 403 && /self-lockout|your own access/i.test(error.message),
  );

  const safeUser = sanitizeAdminUserRecord({
    id: 'admin-1',
    email: 'admin@qiu.edu.my',
    normalizedEmail: 'admin@qiu.edu.my',
    name: 'Admin User',
    role: 'SUPER_ADMIN',
    avatarUrl: 'https://example.com/a.png',
    firebaseUid: 'firebase-secret',
    loginAllowed: true,
    accountStatus: 'ACTIVE',
    identitySource: 'FIREBASE',
    roleAssignments: [
      {
        id: 'assign-1',
        role: 'SUPER_ADMIN',
        scopeType: 'GLOBAL',
        scopeValue: 'GLOBAL',
        metadata: { privateKey: 'should-not-leak' },
      },
    ],
  });

  assert.equal('firebaseUid' in safeUser, false);
  assert.equal(JSON.stringify(safeUser).includes('should-not-leak'), false);

  const safeAudit = sanitizeAdminAuditRecord({
    id: 'audit-1',
    action: 'ADMIN_USER_UPDATED',
    resourceType: 'User',
    resourceId: 'admin-1',
    before: { refreshToken: 'secret-token' },
    after: { privateKey: 'super-secret', name: 'Admin User' },
    metadata: { credentialBlob: 'hidden' },
  });

  assert.equal(safeAudit.before.refreshToken, '[REDACTED]');
  assert.equal(safeAudit.after.privateKey, '[REDACTED]');
  assert.equal(safeAudit.metadata.credentialBlob, '[REDACTED]');
});

test('updateAdminUser creates a linked student row when a complete student profile is added to a user without one', async () => {
  const { prisma, state } = createPrismaStub({
    users: [
      {
        id: 'user-2',
        email: 'employer@qiu.edu.my',
        normalizedEmail: 'employer@qiu.edu.my',
        name: 'Employer User',
        role: 'EMPLOYER',
        avatarUrl: null,
        firebaseUid: null,
        loginAllowed: true,
        accountStatus: 'ACTIVE',
        identitySource: 'MANUAL',
      },
    ],
  });

  const updated = await updateAdminUser({
    identity: createIdentity({
      role: 'SUPER_ADMIN',
      assignments: [{ role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeValue: 'GLOBAL' }],
    }),
    targetUserId: 'user-2',
    input: {
      studentProfile: {
        matricNo: 'QIU-202404-007199',
        facultyId: 'computing_engineering',
        programmeId: 'programme-1',
        academicYear: 3,
      },
    },
    prismaClient: prisma,
    requestId: 'req-create-student-link',
  });

  assert.equal(updated.student.matricNo, 'QIU-202404-007199');
  assert.equal(state.students.length, 1);
  assert.equal(state.students[0].userId, 'user-2');
});

test('updateAdminUser reloads existing outbox response when the transactional dedupe write races with another request', async () => {
  const { prisma, operations, state } = createPrismaStub({
    users: [
      {
        id: 'user-3',
        email: 'person@qiu.edu.my',
        normalizedEmail: 'person@qiu.edu.my',
        name: 'Person',
        role: 'EMPLOYER',
        avatarUrl: null,
        firebaseUid: null,
        loginAllowed: true,
        accountStatus: 'ACTIVE',
        identitySource: 'MANUAL',
      },
    ],
    failNextOutboxCreate: true,
    outboxFailureExistingEvent: {
      id: 'outbox-existing-update',
      topic: 'admin.user.updated',
      aggregateType: 'User',
      aggregateId: 'user-3',
      dedupeKey: 'admin.users.update:user-3:race-update',
      payload: {
        requestId: 'req-existing-update',
        response: {
          user: {
            id: 'user-3',
            email: 'person@qiu.edu.my',
            normalizedEmail: 'person@qiu.edu.my',
            name: 'Updated By Winner',
            role: 'EMPLOYER',
            avatarUrl: null,
            loginAllowed: true,
            accountStatus: 'ACTIVE',
            identitySource: 'MANUAL',
          },
          student: null,
          assignments: [],
        },
      },
    },
  });

  const result = await updateAdminUser({
    identity: createIdentity({
      role: 'SUPER_ADMIN',
      assignments: [{ role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeValue: 'GLOBAL' }],
    }),
    targetUserId: 'user-3',
    input: {
      name: 'Attempted Update',
    },
    prismaClient: prisma,
    requestId: 'req-race-update',
    idempotencyKey: 'race-update',
  });

  assert.equal(result.user.name, 'Updated By Winner');
  assert.equal(operations.outboxFailures, 1);
  assert.equal(state.outboxEvents.length, 1);
});

test('listAdminAudit hides out-of-scope resources even when the actor is in scope and treats dateTo as inclusive through the whole day', async () => {
  const { prisma } = createPrismaStub({
    users: [
      {
        id: 'actor-1',
        email: 'coord@qiu.edu.my',
        normalizedEmail: 'coord@qiu.edu.my',
        name: 'Scoped Coord',
        role: 'CPDC_ADMIN',
        avatarUrl: null,
        firebaseUid: null,
        loginAllowed: true,
        accountStatus: 'ACTIVE',
        identitySource: 'MANUAL',
      },
      {
        id: 'user-in-scope',
        email: 'student1@qiu.edu.my',
        normalizedEmail: 'student1@qiu.edu.my',
        name: 'Scoped Student',
        role: 'STUDENT',
        avatarUrl: null,
        firebaseUid: null,
        loginAllowed: true,
        accountStatus: 'ACTIVE',
        identitySource: 'MANUAL',
      },
      {
        id: 'user-out-scope',
        email: 'student2@qiu.edu.my',
        normalizedEmail: 'student2@qiu.edu.my',
        name: 'Outside Student',
        role: 'STUDENT',
        avatarUrl: null,
        firebaseUid: null,
        loginAllowed: true,
        accountStatus: 'ACTIVE',
        identitySource: 'MANUAL',
      },
    ],
    students: [
      {
        id: 'student-in-scope',
        userId: 'user-in-scope',
        matricNo: 'QIU-202404-007157',
        facultyId: 'computing_engineering',
        programmeId: 'programme-1',
        academicYear: 2,
      },
      {
        id: 'student-out-scope',
        userId: 'user-out-scope',
        matricNo: 'QIU-202404-007158',
        facultyId: 'business',
        programmeId: 'programme-2',
        academicYear: 2,
      },
    ],
    audits: [
      {
        id: 'audit-1',
        actorUserId: 'actor-1',
        action: 'ADMIN_USER_UPDATED',
        resourceType: 'User',
        resourceId: 'user-in-scope',
        before: { name: 'Old Scoped' },
        after: { name: 'New Scoped' },
        requestId: 'req-audit-1',
        metadata: null,
        createdAt: '2026-08-01T20:00:00.000Z',
      },
      {
        id: 'audit-2',
        actorUserId: 'actor-1',
        action: 'ADMIN_USER_UPDATED',
        resourceType: 'User',
        resourceId: 'user-out-scope',
        before: { name: 'Old Outside' },
        after: { name: 'New Outside' },
        requestId: 'req-audit-2',
        metadata: null,
        createdAt: '2026-08-01T12:00:00.000Z',
      },
      {
        id: 'audit-3',
        actorUserId: 'actor-1',
        action: 'LOGBOOK_ENTRY_UPDATED',
        resourceType: 'LogbookEntry',
        resourceId: 'logbook-out',
        before: { studentId: 'student-out-scope' },
        after: { studentId: 'student-out-scope' },
        requestId: 'req-audit-3',
        metadata: null,
        createdAt: '2026-08-01T13:00:00.000Z',
      },
    ],
  });

  const result = await listAdminAudit({
    identity: createIdentity(),
    filters: {
      page: 1,
      pageSize: 10,
      action: '',
      resource: '',
      actor: '',
      dateFrom: '',
      dateTo: '2026-08-01',
    },
    prismaClient: prisma,
  });

  assert.deepEqual(result.items.map((item) => item.id), ['audit-1']);
});
