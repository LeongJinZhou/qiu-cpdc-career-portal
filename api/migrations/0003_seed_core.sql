-- Default settings and the role permissions of slice 1 (docs/SPEC.md sections 2 and 3).

INSERT INTO setting (organisation_id, setting_key, value) VALUES
    (1, 'google_hosted_domains', '["qiu.edu.my"]'),
    (1, 'student_employee_types', '["Student"]'),
    (1, 'display_timezone', '"Asia/Kuala_Lumpur"'),
    (1, 'page_size_default', '50'),
    (1, 'page_size_max', '200'),
    (1, 'session_idle_minutes', '120'),
    (1, 'session_absolute_hours', '12'),
    (1, 'rate_limit_ip_per_minute', '120'),
    (1, 'rate_limit_user_per_minute', '300'),
    (1, 'rate_login_per_ip_per_min', '10'),
    (1, 'rate_pdf_import_per_user_per_min', '5'),
    (1, 'rate_export_per_user_per_min', '10'),
    (1, 'alumni_job_confirm_days', '180'),
    (1, 'consent_version', '"2026-11-25"'),
    (1, 'qiu_linkedin_page_url', '"https://www.linkedin.com/school/questinternationaluniversity/"'),
    (1, 'pdf_import_max_bytes', '5242880');

-- Permissions: profile.own (own career profile), people.view (people list), people.roles (change roles),
-- alumni.track (tracker + CSV), alumni.convert (student -> alumni), registrations.decide (graduate sign-ups),
-- audit.view, settings.manage. Deny by default: a role without a row has no access.
INSERT INTO role_permission (organisation_id, role, permission, scope) VALUES
    (1, 'superadmin', 'profile.own', 'own'),
    (1, 'superadmin', 'people.view', 'all'),
    (1, 'superadmin', 'people.roles', 'all'),
    (1, 'superadmin', 'alumni.track', 'all'),
    (1, 'superadmin', 'alumni.convert', 'all'),
    (1, 'superadmin', 'registrations.decide', 'all'),
    (1, 'superadmin', 'audit.view', 'all'),
    (1, 'superadmin', 'settings.manage', 'all'),
    (1, 'admin', 'profile.own', 'own'),
    (1, 'admin', 'people.view', 'all'),
    (1, 'admin', 'people.roles', 'all'),
    (1, 'admin', 'alumni.track', 'all'),
    (1, 'admin', 'alumni.convert', 'all'),
    (1, 'admin', 'registrations.decide', 'all'),
    (1, 'admin', 'audit.view', 'all'),
    (1, 'staff', 'profile.own', 'own'),
    (1, 'student', 'profile.own', 'own'),
    (1, 'alumni', 'profile.own', 'own');
