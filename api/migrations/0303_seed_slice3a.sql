-- Permissions and settings of slice 3a. Deny by default: pending accounts get none of these.
-- workshops.view (list and detail), workshops.rsvp (RSVP, cancel, check in with the code), workshops.manage (create,
-- edit, cancel, attendance list and CSV), cv.own (own CV), careerpath.view (paths, own progress),
-- careerpath.manage (write paths).

INSERT INTO setting (organisation_id, setting_key, value) VALUES
    (1, 'rate_checkin_per_user_per_min', '10'),
    (1, 'workshop_checkin_opens_minutes', '30');

INSERT INTO role_permission (organisation_id, role, permission, scope) VALUES
    (1, 'superadmin', 'workshops.view', 'all'),
    (1, 'superadmin', 'workshops.rsvp', 'own'),
    (1, 'superadmin', 'workshops.manage', 'all'),
    (1, 'superadmin', 'cv.own', 'own'),
    (1, 'superadmin', 'careerpath.view', 'all'),
    (1, 'superadmin', 'careerpath.manage', 'all'),
    (1, 'admin', 'workshops.view', 'all'),
    (1, 'admin', 'workshops.rsvp', 'own'),
    (1, 'admin', 'workshops.manage', 'all'),
    (1, 'admin', 'cv.own', 'own'),
    (1, 'admin', 'careerpath.view', 'all'),
    (1, 'admin', 'careerpath.manage', 'all'),
    (1, 'staff', 'workshops.view', 'all'),
    (1, 'staff', 'workshops.rsvp', 'own'),
    (1, 'staff', 'cv.own', 'own'),
    (1, 'staff', 'careerpath.view', 'all'),
    (1, 'student', 'workshops.view', 'all'),
    (1, 'student', 'workshops.rsvp', 'own'),
    (1, 'student', 'cv.own', 'own'),
    (1, 'student', 'careerpath.view', 'all'),
    (1, 'alumni', 'workshops.view', 'all'),
    (1, 'alumni', 'workshops.rsvp', 'own'),
    (1, 'alumni', 'cv.own', 'own'),
    (1, 'alumni', 'careerpath.view', 'all');
