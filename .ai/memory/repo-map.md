# Repository Structure Map
Last Updated: Mon Aug  3 11:50:58 +08 2026

## File Tree
```
.
|-- CLAUDE.md
|-- CODEX.md
|-- README.md
|-- app
|   |-- (portal)
|   |   |-- admin
|   |   |-- ai-suite
|   |   |-- assessments
|   |   |-- career-path
|   |   |-- cv
|   |   |-- dashboard
|   |   |-- diagnostics
|   |   |-- employers
|   |   |-- fyp
|   |   |-- help
|   |   |-- layout.jsx
|   |   |-- learning
|   |   |-- loading.jsx
|   |   |-- logbook
|   |   |-- network
|   |   |-- settings
|   |   |-- talent
|   |   `-- workshops
|   |-- api
|   |   |-- admin
|   |   |-- applications
|   |   |-- approvals
|   |   |-- assessments
|   |   |-- auth
|   |   |-- career
|   |   |-- career-path
|   |   |-- cv
|   |   |-- diagnostics
|   |   |-- faculties
|   |   |-- fyp
|   |   |-- identity
|   |   |-- jobs
|   |   |-- learning
|   |   |-- logbook
|   |   |-- notifications
|   |   |-- onboarding
|   |   |-- profile
|   |   |-- student
|   |   |-- students
|   |   |-- talent
|   |   |-- workshops
|   |   `-- xp
|   |-- approve
|   |   `-- [token]
|   |-- globals.css
|   |-- icon.png
|   |-- layout.jsx
|   |-- loading.jsx
|   |-- login
|   |   `-- page.jsx
|   |-- logout
|   |   `-- page.jsx
|   |-- not-found.jsx
|   |-- onboarding
|   |   `-- page.jsx
|   |-- page.jsx
|   `-- privacy
|       `-- page.jsx
|-- apphosting.yaml
|-- components
|   |-- AICareerSuite.jsx
|   |-- AdminControlCenter.jsx
|   |-- AdminSuperDashboard.jsx
|   |-- AlumniNetwork.jsx
|   |-- AssessmentWorkspace.jsx
|   |-- AutoCVEngine.jsx
|   |-- CareerPath.jsx
|   |-- DiagnosticTests.jsx
|   |-- EmployerMarketplace.jsx
|   |-- EmployerWorkspace.jsx
|   |-- FYPShowcase.jsx
|   |-- HelpCenter.jsx
|   |-- LearningHub.jsx
|   |-- LoadingScreen.jsx
|   |-- ModularLogbook.jsx
|   |-- OnboardingTour.jsx
|   |-- ProfileSettings.jsx
|   |-- RoleModuleNotice.jsx
|   |-- RoleSettings.jsx
|   |-- SettingsEngine.jsx
|   |-- StudentDashboard.jsx
|   |-- SupervisorMagicApproval.jsx
|   |-- TalentFeed.jsx
|   |-- WorkshopHub.jsx
|   |-- admin
|   |   |-- AdminUI.jsx
|   |   |-- AtRiskRadar.jsx
|   |   |-- AuditLogPanel.jsx
|   |   |-- DataExplorer.jsx
|   |   |-- FypApprovalQueue.jsx
|   |   |-- IdentityManagement.jsx
|   |   |-- LogbookReviewQueue.jsx
|   |   |-- StudentDirectory.jsx
|   |   |-- StudentRecord.jsx
|   |   |-- WorkshopRequestQueue.jsx
|   |   |-- cohort.js
|   |   `-- roleConsole.js
|   |-- auth
|   |   `-- AutoDetectedField.jsx
|   |-- cv
|   |   |-- BulletFeedback.jsx
|   |   |-- ManualEntries.jsx
|   |   `-- ResumeDocument.jsx
|   |-- employer
|   |   |-- CandidateCard.jsx
|   |   |-- CompanyProfilePanel.jsx
|   |   |-- InviteDialog.jsx
|   |   `-- VacanciesBoard.jsx
|   |-- fyp
|   |   |-- DualSyncPreview.jsx
|   |   |-- GuidedForm.jsx
|   |   `-- PosterUpload.jsx
|   |-- help
|   |   |-- GlossaryList.jsx
|   |   |-- GuideCard.jsx
|   |   |-- RoleStartHere.jsx
|   |   `-- TroubleshootingList.jsx
|   |-- learning
|   |   |-- CertificateSubmitModal.jsx
|   |   |-- CourseCard.jsx
|   |   |-- CourseDetail.jsx
|   |   |-- CourseStandalonePage.jsx
|   |   |-- PathCard.jsx
|   |   `-- VerificationQueue.jsx
|   |-- marketing
|   |   |-- CountUp.jsx
|   |   |-- EmployersSection.jsx
|   |   |-- FacultyGrid.jsx
|   |   |-- FacultyJourney.jsx
|   |   |-- FeatureHighlights.jsx
|   |   |-- Hero.jsx
|   |   |-- JourneyTimeline.jsx
|   |   |-- PlatformNumbers.jsx
|   |   |-- PortalPreview.jsx
|   |   |-- RevealSection.jsx
|   |   |-- SiteFooter.jsx
|   |   `-- SiteHeader.jsx
|   |-- network
|   |   `-- AlumniProfilePage.jsx
|   |-- notifications
|   |   `-- NotificationBell.jsx
|   |-- onboarding
|   |   `-- ConnectAccounts.jsx
|   |-- portal
|   |   |-- OnboardingGate.jsx
|   |   |-- PortalProvider.jsx
|   |   |-- PortalShell.jsx
|   |   |-- QiuLogo.jsx
|   |   `-- RoleGuard.jsx
|   |-- settings
|   |   |-- AccountProfileForm.jsx
|   |   |-- PersonalDetailsForm.jsx
|   |   `-- ResumeEditor.jsx
|   |-- ui
|   |   |-- Avatar.jsx
|   |   |-- DismissibleDialog.jsx
|   |   `-- useAccessibleTabs.js
|   `-- workshops
|       |-- CheckInSheet.jsx
|       |-- EventBuilder.jsx
|       |-- EventCard.jsx
|       |-- WorkshopDetailPage.jsx
|       `-- eventCatalogue.jsx
|-- docs
|   |-- GO-LIVE-AND-ROLE-GUIDE.md
|   |-- LEARNING-CATALOGUE.md
|   |-- SKILL-ROUTING.md
|   |-- SKILLS-INVENTORY.md
|   |-- USER-GUIDE.md
|   `-- superpowers
|       |-- plans
|       `-- specs
|-- firebase.json
|-- jsconfig.json
|-- lib
|   |-- admin
|   |   |-- bootstrap.js
|   |   |-- identity-policy.js
|   |   `-- route-auth.js
|   |-- api.js
|   |-- assessment.js
|   |-- audit
|   |   `-- index.js
|   |-- auth
|   |   |-- actor.js
|   |   |-- config.js
|   |   |-- firebase-admin.js
|   |   |-- firebase-client.js
|   |   |-- identity.js
|   |   |-- logout.js
|   |   |-- permissions.js
|   |   |-- session.js
|   |   `-- student-profile-visibility.js
|   |-- automation.js
|   |-- csv.js
|   |-- cv.js
|   |-- data
|   |   |-- audit.js
|   |   |-- courses-expansion.js
|   |   |-- courses.js
|   |   |-- diagnostics.js
|   |   |-- employers.js
|   |   |-- facultyData.js
|   |   |-- guides.js
|   |   |-- programme-codes.js
|   |   |-- roadmaps.js
|   |   `-- talent.js
|   |-- email.js
|   |-- faculty-context.js
|   |-- fyp-review.js
|   |-- fyp-status-policy.js
|   |-- fyp-status.js
|   |-- identity
|   |   |-- provider.js
|   |   `-- student-id.js
|   |-- integrations
|   |   |-- acms-sis.js
|   |   `-- google-directory.js
|   |-- learning
|   |   `-- liveness.js
|   |-- magic-link.js
|   |-- matching.js
|   |-- modules.js
|   |-- next-best-action.js
|   |-- notifications.js
|   |-- onboarding
|   |   |-- connections.js
|   |   |-- oauth.js
|   |   |-- policy.js
|   |   `-- service.js
|   |-- prisma.js
|   |-- settings
|   |   |-- policy.js
|   |   `-- shared.js
|   |-- settings.js
|   |-- workshop-policy.js
|   |-- xp-events.js
|   |-- xp-ledger.js
|   |-- xp-summary.js
|   `-- xp.js
|-- next.config.mjs
|-- package-lock.json
|-- package.json
|-- postcss.config.mjs
|-- prisma
|   |-- schema.prisma
|   `-- seed.mjs
|-- public
|   |-- QIU\ Logo\ -\ Black.png
|   |-- QIU\ Logo.png
|   `-- brand
|       |-- qiu-logo-horizontal-dark.png
|       |-- qiu-logo-horizontal-light.png
|       |-- qiu-logo-stacked-dark.png
|       |-- qiu-logo-stacked-light.png
|       |-- qiu-mark-dark.png
|       `-- qiu-mark-light.png
|-- scripts
|   |-- auto-skill-router.mjs
|   |-- autonomous_deploy_agent.mjs
|   |-- bootstrap-super-admin.mjs
|   |-- build-brand-assets.mjs
|   |-- seed-demo-students.mjs
|   `-- sync-catalog.mjs
`-- tests
    |-- admin
    |   |-- admin-identity-policy.test.mjs
    |   |-- bootstrap-admin.test.mjs
    |   |-- role-assignment-drift.test.mjs
    |   `-- student-directory-scope.test.mjs
    |-- assessment-runtime.test.mjs
    |-- audit
    |   `-- audit-shape.test.mjs
    |-- auth
    |   |-- permissions.test.mjs
    |   |-- self-service-profile.test.mjs
    |   |-- session-policy.test.mjs
    |   |-- student-profile-visibility.test.mjs
    |   `-- student-role-guard.test.mjs
    |-- automation
    |   `-- lifecycle-decision.test.mjs
    |-- client
    |   `-- canonical-session-contract.test.mjs
    |-- google-directory.test.mjs
    |-- identity
    |   `-- student-id.test.mjs
    |-- learning
    |   `-- liveness.test.mjs
    |-- matching-engine.test.mjs
    |-- matching-faculty-tailoring.test.mjs
    |-- modules-1-5-summary.test.mjs
    |-- modules-2-3-policy.test.mjs
    |-- modules-2-3-status.test.mjs
    |-- modules-4-email.test.mjs
    |-- modules-5-policy.test.mjs
    |-- onboarding
    |   |-- connections.test.mjs
    |   `-- policy.test.mjs
    |-- programme-codes.test.mjs
    |-- security
    |   `-- csv-export.test.mjs
    |-- settings
    |   `-- settings-policy.test.mjs
    `-- tooling
        `-- skill-router.test.mjs

95 directories, 216 files
```

## Recent Git Status
```
 M .ai/memory/repo-map.md
```
