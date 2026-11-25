-- Slice 2b settings, permissions and the default skill areas.

INSERT INTO setting (organisation_id, setting_key, value) VALUES
    (1, 'upload_pdf_max_bytes', '5242880'),
    (1, 'rate_upload_per_user_per_min', '10');

-- jobs.browse (open jobs, apply, own applications), jobs.manage (employers, jobs, every application),
-- skills.own (own self-rating and gap view), learning.own (own courses and certificates),
-- learning.verify (CPDC checks learning records). Deny by default.
INSERT INTO role_permission (organisation_id, role, permission, scope) VALUES
    (1, 'superadmin', 'jobs.manage', 'all'),
    (1, 'superadmin', 'learning.verify', 'all'),
    (1, 'admin', 'jobs.manage', 'all'),
    (1, 'admin', 'learning.verify', 'all'),
    (1, 'student', 'jobs.browse', 'own'),
    (1, 'student', 'skills.own', 'own'),
    (1, 'student', 'learning.own', 'own'),
    (1, 'alumni', 'jobs.browse', 'own'),
    (1, 'alumni', 'skills.own', 'own'),
    (1, 'alumni', 'learning.own', 'own');

INSERT INTO skill_area (organisation_id, name, description, position) VALUES
    (1, 'Communication', 'Writing and speaking clearly to different audiences.', 1),
    (1, 'Teamwork', 'Working with others towards a shared goal.', 2),
    (1, 'Problem solving', 'Breaking a problem down and finding a workable answer.', 3),
    (1, 'Digital literacy', 'Using office, online and collaboration tools well.', 4),
    (1, 'Data analysis', 'Reading, cleaning and drawing conclusions from data.', 5),
    (1, 'Programming', 'Writing working code in at least one language.', 6),
    (1, 'Leadership', 'Taking the lead, deciding and helping others do their best.', 7),
    (1, 'Project management', 'Planning work, keeping to time and reporting progress.', 8);
