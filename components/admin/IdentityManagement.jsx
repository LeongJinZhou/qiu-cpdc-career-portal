'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, PencilLine, Plus, RefreshCcw, Search, ShieldAlert, UserPlus, X } from 'lucide-react';

import { FACULTIES } from '@/lib/data/facultyData';

const ROLE_OPTIONS = ['STUDENT', 'EMPLOYER', 'ALUMNI', 'ACADEMIC_SUPERVISOR', 'PLACEMENT_OFFICER', 'CAREER_COUNSELOR', 'UNIVERSITY_REGISTRAR', 'CPDC_ADMIN', 'FACULTY_COORDINATOR', 'HEAD_OF_PROGRAMME', 'SUPER_ADMIN'];
const STATUS_OPTIONS = ['ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED'];
const SCOPE_OPTIONS = ['SELF', 'STUDENT', 'FACULTY', 'PROGRAMME', 'GLOBAL'];

function createEmptyForm() {
  return {
    email: '',
    name: '',
    avatarUrl: '',
    primaryRole: 'STUDENT',
    loginAllowed: true,
    // An allowlisted Google email should be usable immediately. "INVITED" is
    // still a valid audit state, but session policy permits an allowlisted
    // invited account to sign in until CPDC changes it.
    status: 'ACTIVE',
    studentProfile: {
      matricNo: '',
      facultyId: '',
      programmeId: '',
      academicYear: '1',
    },
    roleAssignments: [
      {
        role: 'STUDENT',
        scopeType: 'SELF',
        scopeValue: 'SELF',
      },
    ],
  };
}

function summarizeScope(user) {
  if (user.student?.programmeId) {
    return `${user.student.facultyId} · ${user.student.programmeId}`;
  }

  if (user.student?.facultyId) {
    return user.student.facultyId;
  }

  if (!user.assignments?.length) {
    return 'Unscoped';
  }

  return user.assignments.map((assignment) => `${assignment.scopeType}:${assignment.scopeValue}`).join(', ');
}

function summarizeStatus(user) {
  return user.loginAllowed ? `${user.accountStatus} · allowlisted` : `${user.accountStatus} · blocked`;
}

function getProgrammesForFaculty(facultyId) {
  return FACULTIES.find((faculty) => faculty.id === facultyId)?.programmes ?? [];
}

function prepareFormFromUser(user) {
  return {
    email: user.user.email ?? '',
    name: user.user.name ?? '',
    avatarUrl: user.user.avatarUrl ?? '',
    primaryRole: user.user.role ?? 'STUDENT',
    loginAllowed: Boolean(user.user.loginAllowed),
    status: user.user.accountStatus ?? 'INVITED',
    studentProfile: {
      matricNo: user.student?.matricNo ?? '',
      facultyId: user.student?.facultyId ?? '',
      programmeId: user.student?.programmeId ?? '',
      academicYear: user.student?.academicYear ? String(user.student.academicYear) : '1',
    },
    roleAssignments: user.assignments?.length
      ? user.assignments.map((assignment) => ({
        role: assignment.role,
        scopeType: assignment.scopeType,
        scopeValue: assignment.scopeValue,
      }))
      : [],
  };
}

function normalizePayload(form, mode) {
  const payload = {
    name: form.name.trim(),
    avatarUrl: form.avatarUrl.trim() || null,
    loginAllowed: Boolean(form.loginAllowed),
    status: form.status,
    primaryRole: form.primaryRole,
    roleAssignments: form.roleAssignments
      .filter((assignment) => assignment.role && assignment.scopeType && assignment.scopeValue)
      .map((assignment) => ({
        role: assignment.role,
        scopeType: assignment.scopeType,
        scopeValue: assignment.scopeValue.trim(),
      })),
  };

  if (mode === 'create') {
    payload.email = form.email.trim();
  } else if (form.email.trim()) {
    payload.email = form.email.trim();
  }

  if (['STUDENT', 'FACULTY_COORDINATOR', 'HEAD_OF_PROGRAMME'].includes(form.primaryRole) || form.studentProfile.matricNo.trim()) {
    payload.studentProfile = {
      matricNo: form.studentProfile.matricNo.trim(),
      facultyId: form.studentProfile.facultyId,
      programmeId: form.studentProfile.programmeId,
      academicYear: Number(form.studentProfile.academicYear || 1),
    };
  }

  return payload;
}

function ApiNotice({ title, body, tone = 'neutral' }) {
  return (
    <div className={`rounded-[20px] border p-4 ${tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-black/10 bg-black/[0.03] text-[#1d1d1f]'}`}>
      <div className="flex items-start gap-3">
        {tone === 'warning' ? <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-crimson" />}
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted">{body}</p>
        </div>
      </div>
    </div>
  );
}

export default function IdentityManagement({ activeFaculty, currentRole }) {
  const [filters, setFilters] = useState({
    query: '',
    role: '',
    status: '',
    facultyId: currentRole === 'FACULTY_COORDINATOR' ? activeFaculty.id : '',
    programmeId: '',
    page: 1,
  });
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(createEmptyForm());
  const [submitting, setSubmitting] = useState(false);
  const pageSize = 10;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    setAuthNotice('');

    try {
      const params = new URLSearchParams();
      params.set('page', String(filters.page));
      params.set('pageSize', String(pageSize));
      if (filters.query) params.set('query', filters.query);
      if (filters.role) params.set('role', filters.role);
      if (filters.status) params.set('status', filters.status);
      if (filters.facultyId) params.set('facultyId', filters.facultyId);
      if (filters.programmeId) params.set('programmeId', filters.programmeId);

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: 'include',
        headers: currentRole ? { 'x-demo-role': currentRole } : {},
      });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        setUsers([]);
        setTotal(0);
        setAuthNotice(payload.error ?? 'A real authenticated CPDC or Super Admin session is required for live identity management.');
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load people and access records.');
      }

      setUsers(payload.items ?? []);
      setTotal(payload.total ?? 0);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }, [filters, currentRole]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setSuccessMessage(''), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  const programmeOptions = useMemo(
    () => getProgrammesForFaculty(form.studentProfile.facultyId),
    [form.studentProfile.facultyId],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function openCreateDrawer() {
    setEditingUser(null);
    setForm(createEmptyForm());
    setDrawerOpen(true);
    setError('');
  }

  function openEditDrawer(user) {
    setEditingUser(user);
    setForm(prepareFormFromUser(user));
    setDrawerOpen(true);
    setError('');
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingUser(null);
    setForm(createEmptyForm());
  }

  function updateForm(path, value) {
    setForm((previous) => {
      const next = structuredClone(previous);
      if (path.startsWith('studentProfile.')) {
        next.studentProfile[path.replace('studentProfile.', '')] = value;
      } else {
        next[path] = value;
      }
      return next;
    });
  }

  function updateAssignment(index, field, value) {
    setForm((previous) => {
      const next = structuredClone(previous);
      next.roleAssignments[index][field] = value;
      return next;
    });
  }

  function addAssignment() {
    setForm((previous) => ({
      ...previous,
      roleAssignments: [
        ...previous.roleAssignments,
        {
          role: 'STUDENT',
          scopeType: 'SELF',
          scopeValue: 'SELF',
        },
      ],
    }));
  }

  function removeAssignment(index) {
    setForm((previous) => ({
      ...previous,
      roleAssignments: previous.roleAssignments.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const mode = editingUser ? 'edit' : 'create';
      const response = await fetch(
        editingUser ? `/api/admin/users/${editingUser.user.id}` : '/api/admin/users',
        {
          method: editingUser ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `${mode}-${Date.now()}`,
            ...(currentRole ? { 'x-demo-role': currentRole } : {}),
          },
          credentials: 'include',
          body: JSON.stringify(normalizePayload(form, mode)),
        },
      );

      const payload = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        setAuthNotice(payload.error ?? 'A real authenticated CPDC or Super Admin session is required for these changes.');
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to save this identity record.');
      }

      setSuccessMessage(editingUser ? 'Identity updated.' : 'Identity created.');
      closeDrawer();
      fetchUsers();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="surface space-y-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">People &amp; access</p>
            <h2 className="mt-1 font-heading text-2xl font-semibold">Live identity management</h2>
            <p className="mt-1 text-sm text-muted">People, student records, approvals, metrics and audit activity are read from the database. In local mode, the selected CPDC or Super Admin view exercises the same policy with the seeded actor; in Firebase mode, only the verified Google session can change access.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={fetchUsers} className="secondary-btn px-3 py-2 text-xs">
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button type="button" onClick={openCreateDrawer} className="crimson-btn px-3 py-2 text-xs">
              <UserPlus className="h-3.5 w-3.5" />
              Add person
            </button>
          </div>
        </div>

        {successMessage ? (
          <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{successMessage}</span>
            </div>
          </div>
        ) : null}

        {authNotice ? (
          <ApiNotice
            tone="warning"
            title="Real authenticated admin session required"
            body={authNotice}
          />
        ) : null}

        {error && !drawerOpen ? <ApiNotice title="Could not load people and access records" body={error} /> : null}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <label className="relative block">
            <span className="sr-only">Search people</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={filters.query}
              onChange={(event) => setFilters((previous) => ({ ...previous, page: 1, query: event.target.value }))}
              placeholder="Search name, email or student ID"
              className="h-11 w-full rounded-[16px] border border-black/10 bg-black/[0.03] pl-10 pr-4 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20"
            />
          </label>
          <select
            aria-label="Filter by role"
            value={filters.role}
            onChange={(event) => setFilters((previous) => ({ ...previous, page: 1, role: event.target.value }))}
            className="h-11 rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson"
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(event) => setFilters((previous) => ({ ...previous, page: 1, status: event.target.value }))}
            className="h-11 rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select
            aria-label="Filter by faculty"
            value={filters.facultyId}
            onChange={(event) => setFilters((previous) => ({ ...previous, page: 1, facultyId: event.target.value, programmeId: '' }))}
            className="h-11 rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson"
          >
            <option value="">All faculties</option>
            {FACULTIES.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.code} · {faculty.name}</option>)}
          </select>
          <select
            aria-label="Filter by programme"
            value={filters.programmeId}
            onChange={(event) => setFilters((previous) => ({ ...previous, page: 1, programmeId: event.target.value }))}
            className="h-11 rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson"
          >
            <option value="">All programmes</option>
            {getProgrammesForFaculty(filters.facultyId).map((programme) => (
              <option key={programme.name} value={programme.name}>{programme.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <caption className="sr-only">University identities and access assignments</caption>
            <thead>
              <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3">Person</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Scope</th>
                <th scope="col" className="px-4 py-3">Student profile</th>
                <th scope="col" className="px-4 py-3">Access</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-14 text-center text-sm text-muted">
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading live identity records…
                    </span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-14 text-center text-sm text-muted">
                    {authNotice ? 'Sign in with a real admin session to view live records.' : 'No users match this filter set.'}
                  </td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.user.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-4">
                    <p className="font-semibold">{user.user.name}</p>
                    <p className="text-xs text-muted">{user.user.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="badge-pill border border-black/10 bg-black/[0.03] text-[#1d1d1f]">{user.user.role}</span>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted">{summarizeScope(user)}</td>
                  <td className="px-4 py-4 text-xs text-muted">
                    {user.student ? `${user.student.matricNo} · Year ${user.student.academicYear}` : 'No linked student record'}
                  </td>
                  <td className="px-4 py-4 text-xs text-muted">{summarizeStatus(user)}</td>
                  <td className="px-4 py-4 text-right">
                    <button type="button" onClick={() => openEditDrawer(user)} className="secondary-btn px-3 py-2 text-xs">
                      <PencilLine className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-black/10 px-4 py-3 text-sm text-muted">
          <span>Page {filters.page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => setFilters((previous) => ({ ...previous, page: previous.page - 1 }))}
              className="secondary-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => setFilters((previous) => ({ ...previous, page: previous.page + 1 }))}
              className="secondary-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[95] flex justify-end bg-black/30" role="presentation" onClick={closeDrawer}>
          <aside
            className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="identity-management-drawer-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-crimson">{editingUser ? 'Edit person' : 'Add person'}</p>
                <h3 id="identity-management-drawer-title" className="mt-1 font-heading text-2xl font-semibold">
                  {editingUser ? form.name || 'Edit identity' : 'Create an allowlisted identity'}
                </h3>
                <p className="mt-1 text-sm text-muted">Server-side policy still decides what is allowed. Privileged role or identity-critical changes require a real Super Admin session.</p>
              </div>
              <button type="button" onClick={closeDrawer} className="rounded-xl p-2 text-muted hover:bg-black/[0.04]" aria-label="Close people and access drawer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              {error ? <ApiNotice title="Could not save this identity record" body={error} /> : null}
              {authNotice ? <ApiNotice tone="warning" title="Real session required" body={authNotice} /> : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Email" htmlFor="identity-email">
                  <input id="identity-email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} className="h-11 w-full rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson" placeholder="person@qiu.edu.my" />
                </Field>
                <Field label="Full name" htmlFor="identity-name">
                  <input id="identity-name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} className="h-11 w-full rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson" placeholder="Staff or student name" />
                </Field>
                <Field label="Avatar URL (optional)" htmlFor="identity-avatar">
                  <input id="identity-avatar" value={form.avatarUrl} onChange={(event) => updateForm('avatarUrl', event.target.value)} className="h-11 w-full rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson" placeholder="https://…" />
                </Field>
                <Field label="Primary role" htmlFor="identity-role">
                  <select id="identity-role" value={form.primaryRole} onChange={(event) => updateForm('primaryRole', event.target.value)} className="h-11 w-full rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson">
                    {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </Field>
                <Field label="Status" htmlFor="identity-status">
                  <select id="identity-status" value={form.status} onChange={(event) => updateForm('status', event.target.value)} className="h-11 w-full rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson">
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </Field>
                <label className="flex items-center gap-3 rounded-[16px] border border-black/10 bg-black/[0.02] px-4 py-3 text-sm">
                  <input type="checkbox" checked={form.loginAllowed} onChange={(event) => updateForm('loginAllowed', event.target.checked)} className="h-4 w-4 rounded border-black/20 text-crimson focus:ring-crimson" />
                  <span>Allowlist for sign-in</span>
                </label>
              </div>

              <p className="text-xs leading-relaxed text-muted">Google SSO is the only sign-in method. An allowlisted email with status Active or Invited can sign in; Suspended and Disabled accounts are blocked.</p>

              <div className="rounded-[20px] border border-black/10 bg-black/[0.02] p-4">
                <div className="mb-4">
                  <p className="font-semibold">Student profile (optional unless the account is a student)</p>
                  <p className="mt-1 text-sm text-muted">Format must be QIU-YYYYMM-NNNNNN. Faculty and programme must match.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Student ID" htmlFor="identity-matric">
                    <input id="identity-matric" value={form.studentProfile.matricNo} onChange={(event) => updateForm('studentProfile.matricNo', event.target.value)} className="h-11 w-full rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson" placeholder="QIU-202404-007157" />
                  </Field>
                  <Field label="Academic year" htmlFor="identity-year">
                    <input id="identity-year" type="number" min="1" max="12" value={form.studentProfile.academicYear} onChange={(event) => updateForm('studentProfile.academicYear', event.target.value)} className="h-11 w-full rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson" />
                  </Field>
                  <Field label="Faculty" htmlFor="identity-faculty">
                    <select id="identity-faculty" value={form.studentProfile.facultyId} onChange={(event) => updateForm('studentProfile.facultyId', event.target.value)} className="h-11 w-full rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson">
                      <option value="">Select faculty</option>
                      {FACULTIES.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.code} · {faculty.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Programme" htmlFor="identity-programme">
                    <select id="identity-programme" value={form.studentProfile.programmeId} onChange={(event) => updateForm('studentProfile.programmeId', event.target.value)} className="h-11 w-full rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson">
                      <option value="">Select programme</option>
                      {programmeOptions.map((programme) => <option key={programme.name} value={programme.name}>{programme.name}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="rounded-[20px] border border-black/10 bg-black/[0.02] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Scoped role assignments</p>
                    <p className="mt-1 text-sm text-muted">Use these to model self, faculty, programme, or global access. The server still validates every assignment.</p>
                  </div>
                  <button type="button" onClick={addAssignment} className="secondary-btn px-3 py-2 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    Add scope
                  </button>
                </div>
                <div className="space-y-3">
                  {form.roleAssignments.length === 0 ? (
                    <p className="text-sm text-muted">No scoped assignments added yet.</p>
                  ) : form.roleAssignments.map((assignment, index) => (
                    <div key={`${assignment.role}-${index}`} className="grid grid-cols-1 gap-3 rounded-[16px] border border-black/10 bg-white p-3 md:grid-cols-[1fr_1fr_1.1fr_auto]">
                      <select value={assignment.role} onChange={(event) => updateAssignment(index, 'role', event.target.value)} aria-label={`Role assignment ${index + 1} role`} className="h-11 rounded-[14px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson">
                        {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                      <select value={assignment.scopeType} onChange={(event) => updateAssignment(index, 'scopeType', event.target.value)} aria-label={`Role assignment ${index + 1} scope type`} className="h-11 rounded-[14px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson">
                        {SCOPE_OPTIONS.map((scopeType) => <option key={scopeType} value={scopeType}>{scopeType}</option>)}
                      </select>
                      <input value={assignment.scopeValue} onChange={(event) => updateAssignment(index, 'scopeValue', event.target.value)} aria-label={`Role assignment ${index + 1} scope value`} className="h-11 rounded-[14px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson" placeholder="SELF, facultyId, programmeId, or GLOBAL" />
                      <button type="button" onClick={() => removeAssignment(index)} className="secondary-btn h-11 px-3 py-2 text-xs">
                        <X className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-black/10 pt-4">
                <button type="button" onClick={closeDrawer} className="secondary-btn px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="crimson-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Saving…</> : editingUser ? 'Save changes' : 'Create identity'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="space-y-1.5 text-sm">
      <span className="font-medium text-[#1d1d1f]">{label}</span>
      {children}
    </label>
  );
}
