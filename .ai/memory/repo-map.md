# Repository Structure Map
Last Updated: Sun Aug  2 12:28:53 +08 2026

## File Tree
```
.
├── CLAUDE.md
├── CODEX.md
├── README.md
├── app
│   ├── (portal)
│   │   ├── admin
│   │   ├── ai-suite
│   │   ├── career-path
│   │   ├── cv
│   │   ├── dashboard
│   │   ├── diagnostics
│   │   ├── employers
│   │   ├── fyp
│   │   ├── help
│   │   ├── layout.jsx
│   │   ├── learning
│   │   ├── loading.jsx
│   │   ├── logbook
│   │   ├── network
│   │   ├── settings
│   │   ├── talent
│   │   └── workshops
│   ├── api
│   │   ├── admin
│   │   ├── applications
│   │   ├── approvals
│   │   ├── auth
│   │   ├── career
│   │   ├── career-path
│   │   ├── cv
│   │   ├── diagnostics
│   │   ├── faculties
│   │   ├── fyp
│   │   ├── identity
│   │   ├── jobs
│   │   ├── learning
│   │   ├── logbook
│   │   ├── profile
│   │   ├── students
│   │   ├── talent
│   │   ├── workshops
│   │   └── xp
│   ├── approve
│   │   └── [token]
│   ├── globals.css
│   ├── icon.png
│   ├── layout.jsx
│   ├── loading.jsx
│   ├── login
│   │   └── page.jsx
│   ├── not-found.jsx
│   ├── onboarding
│   │   └── page.jsx
│   ├── page.jsx
│   └── privacy
│       └── page.jsx
├── components
│   ├── AICareerSuite.jsx
│   ├── AdminControlCenter.jsx
│   ├── AdminSuperDashboard.jsx
│   ├── AlumniNetwork.jsx
│   ├── AutoCVEngine.jsx
│   ├── CareerPath.jsx
│   ├── DiagnosticTests.jsx
│   ├── EmployerMarketplace.jsx
│   ├── EmployerWorkspace.jsx
│   ├── FYPShowcase.jsx
│   ├── HelpCenter.jsx
│   ├── LearningHub.jsx
│   ├── LoadingScreen.jsx
│   ├── ModularLogbook.jsx
│   ├── OnboardingTour.jsx
│   ├── ProfileSettings.jsx
│   ├── RoleModuleNotice.jsx
│   ├── RoleSettings.jsx
│   ├── SettingsEngine.jsx
│   ├── StudentDashboard.jsx
│   ├── SupervisorMagicApproval.jsx
│   ├── TalentFeed.jsx
│   ├── WorkshopHub.jsx
│   ├── admin
│   │   ├── AdminUI.jsx
│   │   ├── AtRiskRadar.jsx
│   │   ├── AuditLogPanel.jsx
│   │   ├── FypApprovalQueue.jsx
│   │   ├── IdentityManagement.jsx
│   │   ├── LogbookReviewQueue.jsx
│   │   └── cohort.js
│   ├── auth
│   │   └── AutoDetectedField.jsx
│   ├── cv
│   │   ├── BulletFeedback.jsx
│   │   ├── ManualEntries.jsx
│   │   └── ResumeDocument.jsx
│   ├── employer
│   │   ├── CandidateCard.jsx
│   │   ├── CompanyProfilePanel.jsx
│   │   ├── InviteDialog.jsx
│   │   └── VacanciesBoard.jsx
│   ├── fyp
│   │   ├── DualSyncPreview.jsx
│   │   ├── GuidedForm.jsx
│   │   └── PosterUpload.jsx
│   ├── learning
│   │   ├── CertificateSubmitModal.jsx
│   │   ├── CourseCard.jsx
│   │   ├── CourseDetail.jsx
│   │   ├── PathCard.jsx
│   │   └── VerificationQueue.jsx
│   ├── marketing
│   │   ├── CountUp.jsx
│   │   ├── EmployersSection.jsx
│   │   ├── FacultyGrid.jsx
│   │   ├── FacultyJourney.jsx
│   │   ├── FeatureHighlights.jsx
│   │   ├── Hero.jsx
│   │   ├── JourneyTimeline.jsx
│   │   ├── PlatformNumbers.jsx
│   │   ├── PortalPreview.jsx
│   │   ├── RevealSection.jsx
│   │   ├── SiteFooter.jsx
│   │   └── SiteHeader.jsx
│   ├── portal
│   │   ├── PortalProvider.jsx
│   │   ├── PortalShell.jsx
│   │   ├── QiuLogo.jsx
│   │   └── RoleGuard.jsx
│   ├── ui
│   │   └── Avatar.jsx
│   └── workshops
│       ├── CheckInSheet.jsx
│       ├── EventBuilder.jsx
│       ├── EventCard.jsx
│       └── eventCatalogue.jsx
├── docs
│   └── superpowers
│       ├── plans
│       └── specs
├── jsconfig.json
├── lib
│   ├── admin
│   │   ├── bootstrap.js
│   │   └── identity-policy.js
│   ├── api.js
│   ├── audit
│   │   └── index.js
│   ├── auth
│   │   ├── actor.js
│   │   ├── config.js
│   │   ├── firebase-admin.js
│   │   ├── firebase-client.js
│   │   ├── identity.js
│   │   ├── permissions.js
│   │   ├── session.js
│   │   └── student-profile-visibility.js
│   ├── automation.js
│   ├── cv.js
│   ├── data
│   │   ├── audit.js
│   │   ├── courses.js
│   │   ├── diagnostics.js
│   │   ├── employers.js
│   │   ├── facultyData.js
│   │   ├── roadmaps.js
│   │   └── talent.js
│   ├── email.js
│   ├── faculty-context.js
│   ├── fyp-review.js
│   ├── fyp-status-policy.js
│   ├── fyp-status.js
│   ├── identity
│   │   ├── provider.js
│   │   └── student-id.js
│   ├── integrations
│   │   └── acms-sis.js
│   ├── magic-link.js
│   ├── matching.js
│   ├── modules.js
│   ├── next-best-action.js
│   ├── prisma.js
│   ├── settings
│   │   ├── policy.js
│   │   └── shared.js
│   ├── settings.js
│   ├── workshop-policy.js
│   ├── xp-events.js
│   ├── xp-ledger.js
│   ├── xp-summary.js
│   └── xp.js
├── next.config.mjs
├── p
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── prisma
│   ├── schema.prisma
│   └── seed.mjs
├── public
│   ├── QIU Logo - Black.png
│   ├── QIU Logo.png
│   └── brand
│       ├── qiu-logo-horizontal-dark.png
│       ├── qiu-logo-horizontal-light.png
│       ├── qiu-logo-stacked-dark.png
│       ├── qiu-logo-stacked-light.png
│       ├── qiu-mark-dark.png
│       └── qiu-mark-light.png
├── scripts
│   ├── bootstrap-super-admin.mjs
│   └── build-brand-assets.mjs
└── tests
    ├── admin
    │   ├── admin-identity-policy.test.mjs
    │   └── bootstrap-admin.test.mjs
    ├── audit
    │   └── audit-shape.test.mjs
    ├── auth
    │   ├── permissions.test.mjs
    │   ├── session-policy.test.mjs
    │   ├── student-profile-visibility.test.mjs
    │   └── student-role-guard.test.mjs
    ├── automation
    │   └── lifecycle-decision.test.mjs
    ├── client
    │   └── canonical-session-contract.test.mjs
    ├── identity
    │   └── student-id.test.mjs
    ├── matching-engine.test.mjs
    ├── matching-faculty-tailoring.test.mjs
    ├── modules-1-5-summary.test.mjs
    ├── modules-2-3-policy.test.mjs
    ├── modules-2-3-status.test.mjs
    ├── modules-4-email.test.mjs
    ├── modules-5-policy.test.mjs
    └── settings
        └── settings-policy.test.mjs

78 directories, 159 files
```

## Recent Git Status
```
 M ../.ai/memory/repo-map.md
 M ../.cursorrules
 M ../AGENTS.md
 M ../CLAUDE.md
 M ../CODEX.md
 M .ai/memory/architecture.md
 M .ai/memory/known-issues.md
 M .env.example
 M app/(portal)/ai-suite/page.jsx
 M app/(portal)/career-path/page.jsx
 M app/(portal)/dashboard/page.jsx
 M app/(portal)/diagnostics/page.jsx
 M app/(portal)/fyp/page.jsx
 M app/(portal)/logbook/page.jsx
 M app/(portal)/network/page.jsx
 M app/api/applications/route.js
 M app/api/approvals/[token]/route.js
 M app/api/career/milestones/route.js
 M app/api/diagnostics/route.js
 M app/api/fyp/approvals/route.js
 M app/api/fyp/route.js
 M app/api/jobs/route.js
 M app/api/logbook/[id]/route.js
 M app/api/logbook/route.js
 M app/api/profile/visibility/route.js
 M app/api/talent/route.js
 M app/api/workshops/check-in/route.js
 M app/api/workshops/route.js
 M app/api/workshops/rsvp/route.js
 M app/login/page.jsx
 M components/AICareerSuite.jsx
 M components/AdminControlCenter.jsx
 M components/AdminSuperDashboard.jsx
 M components/AlumniNetwork.jsx
 M components/CareerPath.jsx
 M components/DiagnosticTests.jsx
 M components/EmployerWorkspace.jsx
 M components/FYPShowcase.jsx
 M components/LearningHub.jsx
 M components/ModularLogbook.jsx
 M components/ProfileSettings.jsx
 M components/StudentDashboard.jsx
 M components/TalentFeed.jsx
 M components/WorkshopHub.jsx
 M components/admin/IdentityManagement.jsx
 M components/employer/VacanciesBoard.jsx
 M components/learning/CertificateSubmitModal.jsx
 M components/learning/CourseCard.jsx
 M components/learning/VerificationQueue.jsx
 M components/marketing/SiteHeader.jsx
 M components/portal/PortalProvider.jsx
 M components/portal/PortalShell.jsx
 M components/ui/Avatar.jsx
 M components/workshops/EventBuilder.jsx
 M components/workshops/eventCatalogue.jsx
 M lib/admin/identity-policy.js
 M lib/api.js
 M lib/auth/actor.js
 M lib/auth/config.js
 M lib/auth/permissions.js
 M lib/data/courses.js
 M lib/data/facultyData.js
 M lib/email.js
 M lib/matching.js
 M lib/modules.js
 M package.json
 M prisma/schema.prisma
 M prisma/seed.mjs
 M tests/auth/session-policy.test.mjs
 M tests/settings/settings-policy.test.mjs
?? .ai/memory/repo-map.md
?? app/api/admin/overview/
?? app/api/career-path/
?? app/api/fyp/[id]/
?? app/api/learning/
?? app/api/logbook/[id]/supervisor/
?? app/api/logbook/reviews/
?? app/api/talent/outreach/
?? components/RoleModuleNotice.jsx
?? components/admin/LogbookReviewQueue.jsx
?? components/learning/CourseDetail.jsx
?? docs/superpowers/plans/2026-08-02-modules-1-5-completion.md
?? lib/auth/student-profile-visibility.js
?? lib/automation.js
?? lib/faculty-context.js
?? lib/fyp-review.js
?? lib/fyp-status-policy.js
?? lib/fyp-status.js
?? lib/workshop-policy.js
?? p
?? tests/auth/student-profile-visibility.test.mjs
?? tests/auth/student-role-guard.test.mjs
?? tests/automation/
?? tests/matching-engine.test.mjs
?? tests/matching-faculty-tailoring.test.mjs
?? tests/modules-1-5-summary.test.mjs
?? tests/modules-2-3-policy.test.mjs
?? tests/modules-2-3-status.test.mjs
?? tests/modules-4-email.test.mjs
?? tests/modules-5-policy.test.mjs
```
