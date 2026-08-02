'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FACULTIES, DEFAULT_STUDENT } from '@/lib/data/facultyData';
import { projectStudentToFaculty, selectProgrammeForFaculty } from '@/lib/faculty-context';
import { getPublicAuthMode } from '@/lib/auth/config';
import {
  applyCanonicalLogbookFailure,
  createUnauthenticatedStudentProjection,
  fetchCanonicalIdentity,
  fetchLogbookEntries,
  mergeCanonicalStudentLogbookEntries,
  normalizeCanonicalIdentity,
  preserveCanonicalStudentFields,
} from '@/lib/api';
import { ROLE_IDS } from '@/lib/modules';

const AUTH_MODE = getPublicAuthMode();
const DEMO_MODE_ENABLED = AUTH_MODE === 'demo' && process.env.NODE_ENV !== 'production';

const STORAGE_KEY = 'qiu.portal.session';
const PROFILE_STORAGE_KEY = 'qiu.portal.profile';

const PortalContext = createContext(null);

function readSavedProfile() {
  try {
    const saved = JSON.parse(window.sessionStorage?.getItem(PROFILE_STORAGE_KEY) ?? 'null');
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
}

function applySavedProfile(student, savedProfile) {
  if (!savedProfile) {
    return student;
  }

  return {
    ...student,
    careerTargets: typeof savedProfile.careerTargets === 'string' ? savedProfile.careerTargets : student.careerTargets ?? '',
    industries: typeof savedProfile.industries === 'string' ? savedProfile.industries : student.industries ?? '',
    bio: typeof savedProfile.bio === 'string' ? savedProfile.bio : student.bio ?? '',
    portfolioUrl: typeof savedProfile.portfolioUrl === 'string' ? savedProfile.portfolioUrl : student.portfolioUrl ?? '',
    githubUrl: typeof savedProfile.githubUrl === 'string' ? savedProfile.githubUrl : student.githubUrl ?? '',
    linkedinUrl: typeof savedProfile.linkedinUrl === 'string' ? savedProfile.linkedinUrl : student.linkedinUrl ?? '',
    skills: Array.isArray(savedProfile.skills) ? savedProfile.skills : student.skills ?? [],
    publicTalent: Boolean(savedProfile.publicTalent),
  };
}

function readDemoSession() {
  try {
    const saved = JSON.parse(window.sessionStorage?.getItem(STORAGE_KEY) ?? 'null');
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
}

function readDemoUrlRole() {
  try {
    const candidate = new URLSearchParams(window.location.search).get('demoRole');
    return typeof candidate === 'string' && ROLE_IDS.includes(candidate.trim()) ? candidate.trim() : null;
  } catch {
    return null;
  }
}

function findFaculty(facultyId) {
  return FACULTIES.find((faculty) => faculty.id === facultyId) ?? FACULTIES[0];
}

export function PortalProvider({ children }) {
  const searchParams = useSearchParams();
  const demoRoleQuery = searchParams.get('demoRole');
  const [identity, setIdentity] = useState(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityError, setIdentityError] = useState('');
  const [currentRoleState, setCurrentRoleState] = useState('STUDENT');
  const [activeFacultyState, setActiveFacultyState] = useState(findFaculty(DEFAULT_STUDENT.facultyId));
  const [studentState, setStudentState] = useState(DEFAULT_STUDENT);
  const [canonicalStudent, setCanonicalStudent] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPortalIdentity() {
      // Everything below runs inside the try/finally on purpose. These three
      // lines used to sit outside it, so any throw here (a corrupt saved
      // profile, a non-cloneable fixture) rejected the promise without ever
      // clearing identityLoading — and RoleGuard renders the loading splash
      // whenever that flag is set, wedging the whole portal on a spinner with
      // nothing in the console. A failure to read local state must degrade to
      // "signed out", never to "loading forever".
      let savedProfile;
      let fallbackStudent;
      let unauthenticatedStudent;

      try {
        savedProfile = readSavedProfile();
        fallbackStudent = applySavedProfile(structuredClone(DEFAULT_STUDENT), savedProfile);
        unauthenticatedStudent = createUnauthenticatedStudentProjection();
      } catch (error) {
        if (!cancelled) {
          console.error('[portal] could not prepare the local identity fallback', error);
          setIdentity(null);
          setCanonicalStudent(null);
          setIdentityError('Your saved session could not be read. Please sign in again.');
          setIdentityLoading(false);
          setHydrated(true);
        }
        return;
      }

      if (DEMO_MODE_ENABLED) {
        const savedSession = readDemoSession();
        const savedRole = ROLE_IDS.includes(savedSession?.role) ? savedSession.role : 'STUDENT';
        const demoRole = readDemoUrlRole() ?? savedRole;
        const demoFaculty = findFaculty(savedSession?.facultyId ?? fallbackStudent.facultyId);
        const demoStudent = projectStudentToFaculty(
          fallbackStudent,
          demoFaculty,
          savedSession?.programme ?? fallbackStudent.programme,
        );
        const normalized = normalizeCanonicalIdentity({
          identity: null,
          fallbackStudent: demoStudent,
          demoRole,
          authMode: AUTH_MODE,
        });

        if (!cancelled) {
          setIdentity(null);
          setIdentityError('');
          setCanonicalStudent(null);
          setCurrentRoleState(normalized.currentRole);
          setActiveFacultyState(normalized.activeFaculty);
          setStudentState(normalized.student);
          setIdentityLoading(false);
          setHydrated(true);
        }
        return;
      }

      try {
        const canonicalIdentity = await fetchCanonicalIdentity();
        const normalized = normalizeCanonicalIdentity({
          identity: canonicalIdentity,
          fallbackStudent,
          authMode: AUTH_MODE,
        });

        let nextStudent = normalized.student;
        let liveLogbookError = null;

        if (normalized.student?.databaseId) {
          try {
            const { entries } = await fetchLogbookEntries(normalized.student.databaseId);
            nextStudent = mergeCanonicalStudentLogbookEntries(normalized.student, entries ?? []);
          } catch (error) {
            liveLogbookError = error.message || 'Your live logbook entries could not be loaded.';
            nextStudent = applyCanonicalLogbookFailure(normalized.student, liveLogbookError);
          }
        }

        if (!cancelled) {
          setIdentity(canonicalIdentity);
          setIdentityError('');
          setCanonicalStudent(nextStudent);
          setCurrentRoleState(normalized.currentRole);
          setActiveFacultyState(normalized.activeFaculty);
          setStudentState(nextStudent);
        }
      } catch (error) {
        if (!cancelled) {
          setIdentity(null);
          setCanonicalStudent(null);
          setCurrentRoleState('STUDENT');
          setActiveFacultyState(findFaculty(unauthenticatedStudent.facultyId));
          setStudentState(unauthenticatedStudent);
          setIdentityError(error.message || 'Sign in is required to load your QIU identity.');
        }
      } finally {
        if (!cancelled) {
          setIdentityLoading(false);
          setHydrated(true);
        }
      }
    }

    loadPortalIdentity();

    return () => {
      cancelled = true;
    };
  }, []);

  // Next navigation can preserve the layout/provider while only the query
  // string changes. Keep direct demo links such as /fyp?demoRole=... honest
  // instead of leaving the previous role in memory and rendering the wrong
  // workspace.
  useEffect(() => {
    if (!DEMO_MODE_ENABLED || !hydrated || identity?.user?.id) return;
    if (!ROLE_IDS.includes(demoRoleQuery)) return;
    setCurrentRoleState(demoRoleQuery);
  }, [demoRoleQuery, hydrated, identity]);

  useEffect(() => {
    if (!DEMO_MODE_ENABLED || !hydrated || identity?.user?.id) {
      return;
    }

    try {
      window.sessionStorage?.setItem(
        STORAGE_KEY,
        JSON.stringify({
          role: currentRoleState,
          facultyId: activeFacultyState.id,
          programme: studentState.programme ?? '',
        }),
      );
    } catch {
      // Storage unavailable; demo selections simply will not persist.
    }
  }, [activeFacultyState.id, currentRoleState, hydrated, identity, studentState.programme]);

  useEffect(() => {
    if (!hydrated) return;

    try {
      window.sessionStorage?.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({
          careerTargets: studentState.careerTargets ?? '',
          industries: studentState.industries ?? '',
          bio: studentState.bio ?? '',
          portfolioUrl: studentState.portfolioUrl ?? '',
          githubUrl: studentState.githubUrl ?? '',
          linkedinUrl: studentState.linkedinUrl ?? '',
          skills: studentState.skills ?? [],
          publicTalent: Boolean(studentState.publicTalent),
        }),
      );
    } catch {
      // Profile changes still work in memory when storage is unavailable.
    }
  }, [hydrated, studentState]);

  const setCurrentRole = useCallback((role) => {
    if (!DEMO_MODE_ENABLED || identity?.user?.id) {
      return;
    }
    setCurrentRoleState(role);
  }, [identity]);

  const setActiveFaculty = useCallback((faculty) => {
    if (!DEMO_MODE_ENABLED || identity?.user?.id) {
      return;
    }
    setActiveFacultyState(faculty);
    setStudentState((previous) => projectStudentToFaculty(previous, faculty));
  }, [identity]);

  const setActiveProgramme = useCallback((programme) => {
    if (!DEMO_MODE_ENABLED || identity?.user?.id) {
      return;
    }
    setStudentState((previous) => selectProgrammeForFaculty(previous, activeFacultyState, programme));
  }, [activeFacultyState, identity]);

  const setStudent = useCallback((value) => {
    setStudentState((previous) => {
      const candidate = typeof value === 'function' ? value(previous) : value;
      if (!candidate) {
        return candidate;
      }

      if (!identity?.user?.id) {
        return candidate;
      }

      return preserveCanonicalStudentFields(candidate, canonicalStudent ?? previous);
    });
  }, [canonicalStudent, identity]);

  const value = useMemo(
    () => ({
      identity,
      identityLoading,
      identityError,
      currentRole: currentRoleState,
      setCurrentRole,
      activeFaculty: activeFacultyState,
      setActiveFaculty,
      setActiveProgramme,
      student: studentState,
      setStudent,
      hydrated,
      demoMode: DEMO_MODE_ENABLED && !identity?.user?.id,
    }),
    [
      activeFacultyState,
      currentRoleState,
      hydrated,
      identity,
      identityError,
      identityLoading,
      setActiveFaculty,
      setActiveProgramme,
      setCurrentRole,
      setStudent,
      studentState,
    ],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error('usePortal must be used inside a PortalProvider');
  }
  return ctx;
}
