-- Slice 2a settings and permissions: logbook, showcase, assessments.

INSERT INTO setting (organisation_id, setting_key, value) VALUES
    (1, 'logbook_review_link_days', '14'),
    (1, 'rate_review_link_per_ip_per_min', '20'),
    (1, 'rate_logbook_send_per_user_per_hour', '20'),
    (1, 'rate_showcase_image_per_user_per_min', '10'),
    (1, 'showcase_image_max_bytes', '2097152');

-- logbook.own (own internship and weeks), logbook.track (every student's progress),
-- showcase.own (own final-year project), showcase.browse (talent feed),
-- assessment.take (take published assessments), assessment.manage (write and publish them).
INSERT INTO role_permission (organisation_id, role, permission, scope) VALUES
    (1, 'student', 'logbook.own', 'own'),
    (1, 'superadmin', 'logbook.track', 'all'),
    (1, 'admin', 'logbook.track', 'all'),
    (1, 'student', 'showcase.own', 'own'),
    (1, 'superadmin', 'showcase.browse', 'all'),
    (1, 'admin', 'showcase.browse', 'all'),
    (1, 'staff', 'showcase.browse', 'all'),
    (1, 'student', 'assessment.take', 'own'),
    (1, 'alumni', 'assessment.take', 'own'),
    (1, 'superadmin', 'assessment.manage', 'all'),
    (1, 'admin', 'assessment.manage', 'all');
